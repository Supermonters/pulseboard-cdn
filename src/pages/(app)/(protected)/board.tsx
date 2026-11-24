/**
 * PulseBoard — gated live board: short pulses, reactions, presence, AI digest.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  RecordScope,
  getUserColor,
  listDeepSpaceAgentModels,
  signOut,
  useAuth,
  useMessages,
  usePresence,
  usePresenceRoom,
  useReactions,
  useUser,
} from 'deepspace'
import type { Message } from 'deepspace'
import type { RecordData } from 'deepspace'
import { useChatChannel } from '../../../components/messaging/hooks/useChatChannel'
import { ChatPanel, type ModelOption } from '../../../components/ChatPanel'
import { messagingSchemas } from '../../../schemas/messaging-schema'
import { APP_NAME, PULSE_CHANNEL } from '../../../constants'

const REACTION_EMOJIS = ['👍', '🔥', '💡', '❤️', '👀'] as const

const DIGEST_PROMPTS = [
  'Call pulse_board, then summarize themes, energy, and open questions.',
  'Call pulse_board, then name the 3 most important pulses and why.',
  'Call pulse_board, then say who has been active and what they posted.',
]

function haikuFirstModels(): ModelOption[] {
  const models = listDeepSpaceAgentModels('application').map((model) => ({
    id: model.id,
    label: model.label,
    provider: model.providerLabel,
  }))
  const haiku = models.filter((m) => m.id.includes('haiku'))
  const rest = models.filter((m) => !m.id.includes('haiku'))
  return [...haiku, ...rest]
}

export default function BoardPage() {
  const { channelId, status } = useChatChannel(PULSE_CHANNEL)
  const { userId } = useAuth()
  const { user } = useUser()
  const [digestOpen, setDigestOpen] = useState(false)
  const [digestChatId, setDigestChatId] = useState<string | null>(null)

  return (
    <div className="pulse-board flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-card/70 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <Link
            to="/"
            className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-foreground"
          >
            {APP_NAME}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            Live room · signed in as {user?.name || 'you'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDigestOpen((open) => !open)}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:brightness-105 sm:text-sm"
          >
            {digestOpen ? 'Hide digest' : 'AI digest'}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)_minmax(280px,360px)]">
        <aside className="hidden min-h-0 border-r border-border/70 bg-shell/60 p-4 lg:block">
          <PresencePanel />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          {status !== 'ready' && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Connecting to the pulse room…
            </div>
          )}
          {status === 'ready' && !channelId && (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Creating the shared pulse channel…
            </div>
          )}
          {status === 'ready' && channelId && (
            <RecordScope roomId={`chat:${channelId}`} schemas={messagingSchemas}>
              <PulseFeed channelId={channelId} />
            </RecordScope>
          )}
        </section>

        <aside
          className={`${
            digestOpen ? 'flex' : 'hidden lg:flex'
          } min-h-0 flex-col border-l border-border/70 bg-shell-panel`}
        >
          <div className="border-b border-border/70 px-4 py-3">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold">
              Board digest
            </h2>
            <p className="text-xs text-muted-foreground">
              Haiku-preferred summary of the live pulses via DeepSpace AI tools.
            </p>
          </div>
          {userId ? (
            <ChatPanel
              key={digestChatId ?? 'new-digest'}
              chatId={digestChatId}
              userId={userId}
              onChatCreated={setDigestChatId}
              models={haikuFirstModels()}
              emptyStatePrompts={DIGEST_PROMPTS}
              compact
              className="min-h-0 flex-1"
              header={
                <button
                  type="button"
                  className="mb-2 w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-left text-xs font-medium text-foreground transition hover:bg-secondary"
                  onClick={() => setDigestChatId(null)}
                >
                  Start a fresh digest chat
                </button>
              }
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Sign in required for digest.</p>
          )}
        </aside>
      </div>

      <div className="border-t border-border/70 bg-card/80 px-4 py-2 lg:hidden">
        <PresencePanel compact />
      </div>
    </div>
  )
}

function PresencePanel({ compact = false }: { compact?: boolean }) {
  const { users, isOnline } = usePresence()
  const online = users.filter((u) => isOnline(u.id))

  if (compact) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{online.length}</span> online
        {online.length > 0 && (
          <>
            {' · '}
            {online
              .slice(0, 4)
              .map((u) => u.name || 'Someone')
              .join(', ')}
            {online.length > 4 ? ` +${online.length - 4}` : ''}
          </>
        )}
      </p>
    )
  }

  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-foreground">
        Online now
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{online.length} in the room</p>
      <ul className="mt-4 space-y-2">
        {online.length === 0 && (
          <li className="text-sm text-muted-foreground">Waiting for heartbeats…</li>
        )}
        {online.map((u) => (
          <li key={u.id} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getUserColor(u.id) }}
              aria-hidden
            />
            <span className="truncate text-foreground">{u.name || u.email || 'Member'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PulseFeed({ channelId }: { channelId: string }) {
  const { messages, status, send } = useMessages(channelId)
  const { getReactionsForMessage, toggle } = useReactions(channelId)
  const { user } = useUser()
  const { peers, updateState } = usePresenceRoom(`pulse:${channelId}`)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)

  const topLevel = useMemo(
    () =>
      messages
        .filter((m) => !m.data.parentMessageId && !m.data.deleted)
        .slice()
        .reverse(),
    [messages],
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [topLevel.length])

  function onDraftChange(value: string) {
    setDraft(value)
    updateState({ typing: true })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => updateState({ typing: false }), 1500)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    setError('')
    try {
      await send(content)
      setDraft('')
      updateState({ typing: false })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const typers = peers.filter((p) => p.state.typing).map((p) => p.userName || 'Someone')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        {status === 'loading' && topLevel.length === 0 && (
          <p className="text-sm text-muted-foreground">Loading pulses…</p>
        )}
        {status === 'ready' && topLevel.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Quiet room
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Post the first pulse — keep it short and present-tense.
            </p>
          </div>
        )}
        {topLevel.map((message) => (
          <PulseCard
            key={message.recordId}
            message={message}
            reactions={getReactionsForMessage(message.recordId)}
            isOwn={
              message.data.authorId === user?.id || message.createdBy === user?.id
            }
            onReact={(emoji) => toggle(message.recordId, emoji)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border/80 bg-card/80 px-4 py-3 backdrop-blur sm:px-6">
        {typers.length > 0 && (
          <p className="mb-2 text-xs text-muted-foreground">{typers.join(', ')} typing…</p>
        )}
        {error && (
          <p role="alert" className="mb-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <form onSubmit={(e) => void onSubmit(e)} className="flex gap-2">
          <input
            aria-label="New pulse"
            value={draft}
            maxLength={280}
            disabled={busy}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Share a short pulse…"
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none ring-ring focus:ring-2"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? '…' : 'Pulse'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PulseCard({
  message,
  reactions,
  isOwn,
  onReact,
}: {
  message: RecordData<Message>
  reactions: { emoji: string; count: number; currentUserReacted: boolean }[]
  isOwn: boolean
  onReact: (emoji: string) => void
}) {
  const author = message.data.authorId || message.createdBy
  const when = new Date(message.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <article
      className={`rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-[var(--shadow-card)] ${
        isOwn ? 'border-primary/30' : ''
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: getUserColor(author) }}
          aria-hidden
        />
        <span className="font-medium text-foreground/80">{isOwn ? 'You' : author.slice(0, 8)}</span>
        <span>·</span>
        <time dateTime={message.createdAt}>{when}</time>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {message.data.content}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {REACTION_EMOJIS.map((emoji) => {
          const existing = reactions.find((r) => r.emoji === emoji)
          const active = existing?.currentUserReacted
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                active
                  ? 'border-primary bg-secondary text-foreground'
                  : 'border-border/80 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {emoji}
              {existing && existing.count > 0 ? ` ${existing.count}` : ''}
            </button>
          )
        })}
      </div>
    </article>
  )
}
