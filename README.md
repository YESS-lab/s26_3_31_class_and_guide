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

Each person gets their own deployed instance with their own URL and isolated data. Railway detects the Dockerfile and builds automatically.

### 1. Create a Railway Account

1. Go to https://railway.com
2. Click **Login** then **Login with GitHub**
3. Railway has a free trial tier. After that, the Hobby plan is $5/month with $5 of included usage.

### 2. Get an Anthropic API Key

1. Go to https://console.anthropic.com/settings/keys
2. Create a new key and copy it (starts with `sk-ant-`)

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

This opens your browser. Log in with the same GitHub account you used to sign up.

### 5. Create a Project

```bash
railway init
```

Give your project a name when prompted (e.g., "rocky-agent").

### 6. Deploy

This is the key step. `railway up` uploads your code, detects the Dockerfile, builds it, and creates a service:

```bash
railway up
```

First deploy takes 2-3 minutes. Wait for it to finish.

### 7. Link to the Service

After the deploy creates your service, link your local directory to it:

```bash
railway service
```

Select the service that was just created.

### 8. Set Your API Key

Now that a service is linked, set the Anthropic API key:

```bash
railway vars set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

This triggers a redeploy automatically.

### 9. Get Your Public URL

Generate a public domain for your app:

```bash
railway domain
```

Your agent is live at the URL Railway gives you (something like `https://rocky-agent-production.up.railway.app`). Share this link with anyone.

### Updating After Changes

Edit your skills or config, then:

```bash
railway up
```

Or connect your GitHub repo in the Railway dashboard for automatic deploys on push.

### Useful Commands

```bash
railway logs          # Server output (useful for debugging)
railway status        # Deployment status
railway vars          # View environment variables
railway down          # Remove most recent deployment
railway delete        # Delete the project entirely
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `No service linked` | Run `railway service` and select your service. |
| `No services found` | Run `railway up` first to create the initial deployment. |
| App won't start | `railway logs` — usually missing API key. Run `railway vars set` again. |
| Build fails | Check that `npm run build` works locally first. |
| Agent acts like generic assistant | Check `.claude/skills/` exists and isn't in `.gitignore`. |
| No public URL | Run `railway domain` to generate one. |
| WebSocket won't connect | The app handles ws/wss automatically. Check `railway logs` for errors. |

## Deploy with Docker (Local)

If you prefer to run locally with Docker instead of Railway:

```bash
# Build the image
docker build -t rocky-agent .

# Run it (replace with your actual API key)
docker run -p 3001:3001 -e ANTHROPIC_API_KEY=sk-ant-your-key-here rocky-agent
```

Open http://localhost:3001

To stop: `docker stop $(docker ps -q --filter ancestor=rocky-agent)`

## Architecture

```
Browser  <-->  Express + WebSocket  <-->  Claude Agent SDK (query())
                                            |
                                       Reads .claude/skills/
                                       Reads CLAUDE.md
                                       Reads .claude/settings.json
```

The SDK spawns Claude Code as a subprocess. Claude Code discovers skills and CLAUDE.md from the project directory. The server bridges WebSocket clients to the SDK via a `MessageQueue` for multi-turn conversations.

Each deployed instance is independent — its own container, its own data, its own URL. No shared state between users.

## Cost

- Railway: Hobby plan $5/month with $5 included usage. Free trial available.
- Docker: Free (runs on your machine).
- Anthropic API: per-conversation token usage.
