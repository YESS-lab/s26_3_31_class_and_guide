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

## Deploy to Railway

### 1. Create a Railway Account

1. Go to https://railway.com
2. Click **Login** then **Login with GitHub**
3. Railway has a free trial tier. After that, the Hobby plan is $5/month with $5 of included usage — more than enough for a class project.

### 2. Get an Anthropic API Key

1. Go to https://console.anthropic.com/settings/keys
2. Create a new key and copy it

### 3. Install the Railway CLI

```bash
npm install -g @railway/cli
```

Verify it works:
```bash
railway --help
```

### 4. Log In

```bash
railway login
```

This opens your browser. Log in with the same GitHub account.

### 5. Create a Project and Deploy

```bash
# Create a new Railway project
railway init

# Link this directory to the project
railway link

# Set your API key as an environment variable
railway vars set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Deploy
railway up
```

### 6. Get Your URL

After deploy completes, generate a public domain:

```bash
railway domain
```

Your agent is live at the URL Railway gives you (something like `https://your-project.up.railway.app`).

### Update After Changes

```bash
railway up
```

Or connect your GitHub repo in the Railway dashboard for automatic deploys on push.

### Useful Commands

```bash
railway logs          # Server output
railway status        # Deployment status
railway vars          # View environment variables
railway down          # Remove most recent deployment
railway delete        # Delete the project entirely
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| App won't start | `railway logs` — usually missing API key. Run `railway vars set` again. |
| Build fails | Check that `npm run build` works locally first. |
| Generic assistant (not Rocky) | Check `.claude/skills/` exists and isn't in `.gitignore`. Check `railway logs` for skill loading. |
| No streaming | Check `includePartialMessages: true` in `server/ai-client.ts`. |
| No public URL | Run `railway domain` to generate one. |

See [docs/DEPLOY.md](docs/DEPLOY.md) for more details.

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

- Railway: Hobby plan $5/month with $5 included usage. Free trial available.
- Anthropic API: per-conversation token usage
