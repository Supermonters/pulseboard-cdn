import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthOverlay, useAuth } from 'deepspace'
import { APP_NAME } from '../../constants'

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  return (
    <div className="pulse-landing relative min-h-full overflow-hidden">
      <div className="pulse-atmosphere" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col px-6 pb-16 pt-10 sm:px-10">
        <header className="flex items-center justify-between gap-4">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {APP_NAME}
          </p>
          {isLoaded && isSignedIn ? (
            <Link
              to="/board"
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
            >
              Open board
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuth(true)}
              className="rounded-full border border-border bg-card/80 px-5 py-2 text-sm font-medium text-foreground backdrop-blur transition hover:bg-card"
            >
              Sign in
            </button>
          )}
        </header>

        <section className="mt-16 flex flex-1 flex-col justify-center gap-10 sm:mt-24 sm:gap-12">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <span className="pulse-dot" aria-hidden />
              Live shared signal
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              {APP_NAME}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Drop a short pulse, react in the moment, see who&apos;s online, and let AI digest the
              room — one live board for your team&apos;s energy right now.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isSignedIn ? (
                <Link
                  to="/board"
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card-hover)] transition hover:brightness-110"
                >
                  Enter the board
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card-hover)] transition hover:brightness-110"
                >
                  Sign in to pulse
                </button>
              )}
              <a
                href="#how"
                className="rounded-full px-5 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                How it works
              </a>
            </div>
          </div>

          <div className="pulse-hero-visual relative h-48 w-full max-w-xl sm:h-56" aria-hidden>
            <div className="pulse-ring pulse-ring-a" />
            <div className="pulse-ring pulse-ring-b" />
            <div className="pulse-ring pulse-ring-c" />
            <div className="pulse-core" />
          </div>
        </section>

        <section id="how" className="mt-20 grid gap-8 border-t border-border/70 pt-10 sm:grid-cols-3">
          <Feature
            title="Short pulses"
            body="Post quick status notes into a shared room. Updates sync live across every open tab."
          />
          <Feature
            title="Reactions + presence"
            body="Tap an emoji, glance at who’s online, and keep the board feeling like a room—not a ticket queue."
          />
          <Feature
            title="AI digest"
            body="Ask Haiku to summarize the current board so latecomers catch the vibe in one pass."
          />
        </section>
      </div>

      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} providers={['google', 'github']} />}
    </div>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
