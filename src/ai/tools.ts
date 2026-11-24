/**
 * AI Tool Definitions — converts DeepSpace BUILT_IN_TOOLS to Vercel AI SDK tools.
 *
 * The assistant can read AND modify data. Per-collection RBAC at the DO
 * layer is the actual security boundary — the user's role determines what
 * each tool call is allowed to do, regardless of what's in this allowlist.
 * Trim entries below if you want a stricter assistant for your app.
 *
 * PulseBoard note: channel metadata lives in the app room (`app:<id>`), but
 * pulse messages + reactions live in per-channel rooms (`chat:<channelId>`).
 * Generic `records.query` only sees the app room, so digests must use
 * `pulse_board` (or another chat-room executor) to read the live feed.
 */

import { jsonSchema, tool } from 'ai'
import type { ToolSet } from 'ai'
import { z } from 'zod/v4'
import {
  BUILT_IN_TOOLS,
  applyAiToolDefaults,
  createUserToolExecutor,
} from 'deepspace/worker'
import type {
  AgentToolContext,
  ToolSchema,
  CollectionSchema,
  UserToolExecutorEnv,
} from 'deepspace/worker'
import { PULSE_CHANNEL } from '../constants'

type ToolExecutor = (toolName: string, params: Record<string, unknown>) => Promise<unknown>

const ALLOWED_TOOL_NAMES = [
  'schema.list',
  'schema.describe',
  'records.query',
  'records.get',
  'records.create',
  'records.update',
  'records.delete',
  'user.current',
]

const PULSE_BOARD_LIMIT = 40

// ============================================================================
// System prompt
// ============================================================================

type Interpretation = CollectionSchema['columns'][number]['interpretation']

/**
 * Interpretation is `string | Record<string, unknown>`. When it's an object
 * the convention across the SDK's schemas is `{ kind: string, ... }`.
 * Narrow safely to a human-readable name.
 */
function interpretationLabel(interpretation: Interpretation): string {
  if (typeof interpretation === 'string') return interpretation
  const kind = interpretation.kind
  return typeof kind === 'string' ? kind : 'object'
}

export function buildSystemPrompt(appName: string, schemas: CollectionSchema[]): string {
  const schemaSummary = schemas
    .map((s) => {
      const cols = (s.columns ?? [])
        .map((c) => `${c.name}:${interpretationLabel(c.interpretation)}${c.required ? '!' : ''}`)
        .join(', ')
      return `- ${s.name}${cols ? ` (${cols})` : ''}`
    })
    .join('\n')

  return [
    `You are the board digest assistant for "${appName}" on DeepSpace.`,
    'PulseBoard is a live shared pulse room: short posts live in the messages',
    `collection for the public channel named "${PULSE_CHANNEL}", with reactions`,
    'and presence.',
    '',
    'CRITICAL data layout:',
    '- Channel rows live in the app room (what generic records_* tools see).',
    '- Pulse messages and reactions live in a separate room: chat:<channelId>.',
    '- Calling records_query on "messages" in the app room returns EMPTY even',
    '  when the board feed is full. That empty result is a room-scope miss,',
    '  not proof the board is quiet.',
    '',
    'When asked for a digest or summary:',
    '- ALWAYS call the pulse_board tool first (it reads the chat room).',
    '- Prefer themes, energy, open questions, and notable pulses — not a raw dump.',
    '- Keep digests short (about 5–8 bullets or a tight paragraph).',
    '- Prefer Claude Haiku when the user has not forced another model.',
    '- Only say the board is empty if pulse_board itself returns zero pulses.',
    '',
    "You can read and modify the user's data via the available tools. The",
    "user's own role and permissions still apply at the data layer — your",
    'tool calls run as the calling user, so you can only do what they could.',
    '',
    'Be careful with mutations:',
    '- Confirm intent before destructive actions (delete, bulk update).',
    '- Prefer read-only digests unless the user asks to change records.',
    '- After a successful write, briefly confirm what changed.',
    '- If a write is denied (RBAC), tell the user plainly — do not retry blindly.',
    '',
    'Use tools to look up facts before answering. Do not invent data.',
    'If data is missing, say so plainly. Keep answers concise.',
    '',
    'Available collections:',
    schemaSummary || '(none)',
  ].join('\n')
}

// ============================================================================
// Tool definitions
// ============================================================================

type QuerySuccess = {
  success: true
  data?: {
    records?: Array<{
      recordId: string
      createdAt?: string
      createdBy?: string
      data?: Record<string, unknown>
    }>
  }
}

function isQuerySuccess(value: unknown): value is QuerySuccess {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as { success: unknown }).success === true
  )
}

async function readPulseBoard(
  appExecutor: ToolExecutor,
  context: AgentToolContext<UserToolExecutorEnv>,
  limit: number,
) {
  const channelResult = await appExecutor(
    'records.query',
    applyAiToolDefaults('records.query', {
      collection: 'channels',
      where: { name: PULSE_CHANNEL, type: 'public' },
      orderBy: 'createdAt',
      orderDir: 'asc',
      limit: 20,
    }),
  )

  if (!isQuerySuccess(channelResult)) {
    return {
      ok: false as const,
      error: 'Failed to list pulse channels in the app room.',
      detail: channelResult,
    }
  }

  const channels = [...(channelResult.data?.records ?? [])].sort(
    (a, b) =>
      String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) ||
      a.recordId.localeCompare(b.recordId),
  )
  const channel = channels.find((row) => row.data?.archived !== true) ?? channels[0]
  if (!channel) {
    return {
      ok: true as const,
      channelName: PULSE_CHANNEL,
      channelId: null,
      roomId: null,
      pulseCount: 0,
      pulses: [],
      note: 'No public pulse channel exists yet.',
    }
  }

  const roomId = `chat:${channel.recordId}`
  const chatExecutor = createUserToolExecutor(context.env, context.userId, context.request.signal, {
    room: roomId,
  })

  const [messagesResult, reactionsResult] = await Promise.all([
    chatExecutor(
      'records.query',
      applyAiToolDefaults('records.query', {
        collection: 'messages',
        orderBy: 'createdAt',
        orderDir: 'desc',
        limit,
      }),
    ),
    chatExecutor(
      'records.query',
      applyAiToolDefaults('records.query', {
        collection: 'reactions',
        orderBy: 'createdAt',
        orderDir: 'desc',
        limit: 100,
      }),
    ),
  ])

  if (!isQuerySuccess(messagesResult)) {
    return {
      ok: false as const,
      error: `Failed to read messages from ${roomId}.`,
      detail: messagesResult,
      channelId: channel.recordId,
      roomId,
    }
  }

  const messageRows = messagesResult.data?.records ?? []
  const reactionRows = isQuerySuccess(reactionsResult) ? (reactionsResult.data?.records ?? []) : []

  const reactionCounts = new Map<string, Record<string, number>>()
  for (const reaction of reactionRows) {
    const messageId = String(reaction.data?.messageId ?? '')
    const emoji = String(reaction.data?.emoji ?? '')
    if (!messageId || !emoji) continue
    const bucket = reactionCounts.get(messageId) ?? {}
    bucket[emoji] = (bucket[emoji] ?? 0) + 1
    reactionCounts.set(messageId, bucket)
  }

  const pulses = messageRows
    .filter((row) => !row.data?.parentMessageId && !row.data?.deleted)
    .map((row) => ({
      id: row.recordId,
      content: String(row.data?.content ?? ''),
      authorId: String(row.data?.authorId ?? row.createdBy ?? ''),
      createdAt: row.createdAt ?? null,
      reactions: reactionCounts.get(row.recordId) ?? {},
    }))

  return {
    ok: true as const,
    channelName: PULSE_CHANNEL,
    channelId: channel.recordId,
    roomId,
    pulseCount: pulses.length,
    pulses,
    note:
      pulses.length === 0
        ? 'Pulse channel exists, but the chat room currently has no top-level pulses.'
        : `Loaded ${pulses.length} recent pulse(s) from ${roomId}.`,
  }
}

export function buildTools(
  executor: ToolExecutor,
  context?: AgentToolContext<UserToolExecutorEnv>,
): ToolSet {
  const tools: ToolSet = {}

  for (const def of BUILT_IN_TOOLS) {
    if (!ALLOWED_TOOL_NAMES.includes(def.name)) continue
    const safeName = def.name.replace('.', '_')
    tools[safeName] = tool({
      description: def.description,
      inputSchema: buildInputSchema(def),
      // Apply assistant-only param defaults (e.g. records.query page size) here
      // in the AI tool layer, so internal record readers that hit the tools
      // dispatch directly stay unbounded.
      execute: async (params: Record<string, unknown>) =>
        executor(def.name, applyAiToolDefaults(def.name, params)),
    })
  }

  tools.pulse_board = tool({
    description:
      'Read recent live PulseBoard pulses and reactions. ALWAYS use this for digests/summaries. ' +
      'Messages live in chat:<channelId>, not the app room — do not trust an empty records_query on messages.',
    inputSchema: jsonSchema<{ limit?: number }>(
      {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: `Max recent pulses to return (1–${PULSE_BOARD_LIMIT}, default ${PULSE_BOARD_LIMIT}).`,
          },
        },
        additionalProperties: false,
      },
      {
        validate: async (value) => {
          const result = await z
            .object({
              limit: z.number().int().min(1).max(PULSE_BOARD_LIMIT).optional(),
            })
            .safeParseAsync(value ?? {})
          return result.success
            ? { success: true, value: result.data }
            : { success: false, error: result.error }
        },
      },
    ),
    execute: async (params: { limit?: number }) => {
      if (!context) {
        return {
          ok: false,
          error: 'pulse_board requires agent tool context (env + caller).',
        }
      }
      const limit = params.limit ?? PULSE_BOARD_LIMIT
      return readPulseBoard(executor, context, limit)
    },
  })

  return tools
}

// ============================================================================
// Convert ToolSchema params → Zod validator + derived provider JSON Schema
// ============================================================================

/**
 * The Zod validator is the single source; the provider-facing JSON Schema is
 * derived from it with Zod's native conversion, which keeps z.record()
 * objects open (`additionalProperties: {}`). The AI SDK's own Zod conversion
 * closes every object, which would incorrectly advertise the free-form
 * `data` and `where` objects as empty — so the conversion happens here.
 */
function buildInputSchema(def: ToolSchema) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [name, param] of Object.entries(def.params)) {
    let s: z.ZodTypeAny
    switch (param.type) {
      case 'string':
        s = z.string()
        break
      case 'number':
        s = z.number()
        break
      case 'boolean':
        s = z.boolean()
        break
      case 'object':
        s = z.record(z.string(), z.unknown())
        break
      case 'array':
        s = z.array(z.unknown())
        break
    }
    if (param.description) s = s.describe(param.description)
    if (!param.required) s = s.optional()
    shape[name] = s
  }

  const validator = z.object(shape)
  return jsonSchema<Record<string, unknown>>(
    z.toJSONSchema(validator) as Parameters<typeof jsonSchema>[0],
    {
      validate: async (value) => {
        const result = await validator.safeParseAsync(value)
        return result.success
          ? { success: true, value: result.data }
          : { success: false, error: result.error }
      },
    },
  )
}
