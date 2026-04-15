# Mindful Consumption Guide — Deployed Agent

A conversational AI agent that helps people examine wants, resist advertising tricks, and find genuine flourishing. Built with the Claude Agent SDK and deployable via a web link.

Meet **Rocky the Eridian** — an alien engineer who genuinely does not understand human consumer culture. Rocky's confusion is real. Rocky's care is real.

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Set your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# Run (starts both backend and frontend)
npm run dev
```

Open http://localhost:5173

## Run Tests

```bash
npm test
```

## How It Works

The agent is defined by **skills** (markdown files in `.claude/skills/`) and a **CLAUDE.md** file. The Claude Agent SDK discovers these automatically via `settingSources: ['project']`.

```
.claude/skills/
  session-start/SKILL.md    — Rocky's personality + intent routing
  want-examination/SKILL.md — Socratic questioning about purchase desires
  reframe/SKILL.md          — Names advertising tricks, offers alternatives
  flourishing-prompt/SKILL.md — Self-care exercises
  gratitude-inventory/SKILL.md — Reflect on what you already have

CLAUDE.md                   — Agent behavior rules (read by SDK automatically)
agent-config.json           — Branding, welcome message, persona fields
```

## Customize for Your Own Agent

Edit two things:

1. **`.claude/skills/`** — Replace with your own skills
2. **`agent-config.json`** — Your agent's name, description, colors, persona fields

See [docs/CUSTOMIZE.md](docs/CUSTOMIZE.md) for details.

## Deploy to Fly.io

### Prerequisites

- [Fly.io account](https://fly.io/app/sign-up) (sign up with GitHub)
- [Fly CLI installed](https://fly.io/docs/flyctl/install/)
- Anthropic API key from https://console.anthropic.com/settings/keys

### Deploy

```bash
# Log in to Fly.io
fly auth login

# Create the app (first time only)
fly launch --no-deploy

# Set your API key as a secret
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Deploy
fly deploy
```

Your agent is live at `https://your-app-name.fly.dev`.

### Update After Changes

```bash
fly deploy
```

### Useful Commands

```bash
fly logs            # Server output
fly status          # Is it running?
fly ssh console     # Shell into the machine
fly apps destroy your-app-name   # Delete entirely
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| App won't start | `fly logs` — usually missing API key. Run `fly secrets set` again. |
| "Cannot connect" | App auto-stopped. Refresh — it restarts on traffic (~10s). |
| Generic assistant (not Rocky) | Check `.claude/skills/` exists and isn't in `.gitignore`. Check `fly logs` for skill loading. |
| No streaming | Check `includePartialMessages: true` in `server/ai-client.ts`. |

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full step-by-step guide.

## Architecture

```
Browser  ←→  Express + WebSocket  ←→  Claude Agent SDK (query())
                                         ↓
                                    Reads .claude/skills/
                                    Reads CLAUDE.md
                                    Reads .claude/settings.json
```

The SDK spawns Claude Code as a subprocess. Claude Code discovers skills and CLAUDE.md from the project directory. The server bridges WebSocket clients to the SDK via a `MessageQueue` for multi-turn conversations.

## Cost

- Fly.io: ~$3-5/month when running, $0 when auto-stopped
- Anthropic API: per-conversation token usage
