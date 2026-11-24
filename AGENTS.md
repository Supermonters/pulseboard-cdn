# PulseBoard

Live shared pulse board on DeepSpace: short posts, reactions, presence, and an AI digest.

## Product map

| Route | Auth | Purpose |
| --- | --- | --- |
| `/` | Optional | Branded landing |
| `/board` | Required (`AuthGate`) | Live pulses + reactions + presence + AI digest |
| `/assistant` | Required | Full AI chat page (from `ai-chat` feature) |
| `/chat` | Required | Stock messaging UI (kept for debugging) |

Integrations used: **Auth**, **messaging records** (channels/messages/reactions), **presence** (`usePresence` + typing via `usePresenceRoom`), **AI chat** (digest panel, Haiku-preferred).

## Commands

```sh
npx deepspace auth whoami --json
npx deepspace auth login          # browser OAuth once
npx deepspace app init --json     # mint DEEPSPACE_APP_ID
npx deepspace deploy --json       # → https://pulseboard-cdn.app.space
npx deepspace dev start           # optional local
```

Read https://docs.deep.space/llms.txt and relevant `.md` pages before changing SDK usage.
The DeepSpace skill lives in `.agents/skills/deepspace/`.

## Version control

Prefer GitHub for this careers submission (public repo). Commit before deploy when using DeepSpace source; with a GitHub remote, deploy ships the working tree.
