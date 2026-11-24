import { describe, expect, it, vi } from 'vitest'
import { buildSystemPrompt, buildTools } from './tools'
import type { AgentToolContext, UserToolExecutorEnv } from 'deepspace/worker'

describe('buildSystemPrompt', () => {
  it('warns that app-room message queries are empty by design', () => {
    const prompt = buildSystemPrompt('PulseBoard', [])
    expect(prompt).toContain('pulse_board')
    expect(prompt).toContain('chat:<channelId>')
    expect(prompt).toContain('returns EMPTY')
  })
})

describe('buildTools pulse_board', () => {
  it('registers pulse_board and reads messages from the chat room', async () => {
    const appExecutor = vi.fn(async (toolName: string, params: Record<string, unknown>) => {
      expect(toolName).toBe('records.query')
      expect(params.collection).toBe('channels')
      return {
        success: true,
        data: {
          records: [
            {
              recordId: 'chan-1',
              createdAt: '2026-01-01T00:00:00.000Z',
              data: { name: 'pulse', type: 'public', archived: false },
            },
          ],
        },
      }
    })

    const chatFetch = vi.fn(async (request: Request) => {
      const body = (await request.json()) as { tool: string; params: { collection: string } }
      if (body.params.collection === 'messages') {
        return Response.json({
          success: true,
          data: {
            records: [
              {
                recordId: 'msg-1',
                createdAt: '2026-01-01T01:00:00.000Z',
                createdBy: 'user-1',
                data: { content: 'Shipping wine theme', authorId: 'user-1' },
              },
            ],
          },
        })
      }
      return Response.json({
        success: true,
        data: {
          records: [
            {
              recordId: 'rxn-1',
              data: { messageId: 'msg-1', emoji: '🔥' },
            },
          ],
        },
      })
    })

    const env = {
      DEEPSPACE_APP_ID: 'app_test',
      RECORD_ROOMS: {
        idFromName: (name: string) => ({ name }),
        get: (id: { name: string }) => {
          expect(id.name).toBe('chat:chan-1')
          return { fetch: chatFetch }
        },
      },
    } as unknown as UserToolExecutorEnv

    const context: AgentToolContext<UserToolExecutorEnv> = {
      env,
      userId: 'user-1',
      request: new Request('https://example.test/api/ai/chat'),
    }

    const tools = buildTools(appExecutor, context)
    expect(tools.pulse_board).toBeDefined()

    const result = await tools.pulse_board.execute!(
      {},
      { toolCallId: 't1', messages: [], context: {} },
    )
    expect(result).toMatchObject({
      ok: true,
      channelId: 'chan-1',
      roomId: 'chat:chan-1',
      pulseCount: 1,
      pulses: [
        {
          id: 'msg-1',
          content: 'Shipping wine theme',
          reactions: { '🔥': 1 },
        },
      ],
    })
    expect(appExecutor).toHaveBeenCalledOnce()
    expect(chatFetch).toHaveBeenCalledTimes(2)
  })
})
