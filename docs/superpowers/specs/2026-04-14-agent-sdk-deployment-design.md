# Deployable Agent via Claude Agent SDK — Design Spec

**Date:** 2026-04-14
**Context:** COS 598/498, Generative AI Agents, Spring 2026, University of Maine
**Authors:** Dr. Amy J Ko, Dr. Sherry Tongshuang Wu, Dr. Greg L Nelson (with Claude)

---

## Purpose

Translate the Mindful Consumption Agent prototype (currently defined as Claude Code skills in `.claude/skills/`) into a deployable agent using the Claude Agent SDK. The deployed agent is accessible via a web link. The deployment scaffold is reusable — any of the 12 course project ideas can be deployed by swapping skills and editing a config file.

## Goals

1. **Deploy the Mindful Consumption Agent** as a working web app anyone can interact with via URL
2. **Create a reusable template** that students fork to deploy their own agents
3. **Keep skills as the single source of truth** — students edit markdown, not code
4. **Minimize infrastructure complexity** — students need Python skills, not DevOps expertise

## Non-Goals

- Production-grade security, auth, or scaling
- Persistent conversation history (designed for later, not built now)
- Custom frontend framework or build pipeline

---

## 1. Architecture Overview

The system has three layers:

```
┌─────────────────────────────────────────────┐
│  Frontend (simple-chatapp fork)             │
│  - Chat UI with message bubbles             │
│  - Persona editor sidebar                   │
│  - File upload widget                       │
│  - Agent name/description branding          │
└──────────────────┬──────────────────────────┘
                   │ Streaming (whatever simple-chatapp uses)
┌──────────────────▼──────────────────────────┐
│  Backend (from simple-chatapp, extended)    │
│  - Serves the frontend                      │
│  - Manages sessions + uploaded files        │
│  - Calls Claude Agent SDK query()           │
│  - Injects user persona into each query     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Agent (Claude Agent SDK)                   │
│  - System prompt: personality + principles  │
│  - Skills loaded from .claude/skills/       │
│  - session-start always invoked first       │
│  - Tools: Skill, Read (for uploaded files)  │
└─────────────────────────────────────────────┘
```

### Key decisions

- The `simple-chatapp` from [claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos/tree/main/simple-chatapp) provides the foundation. We extend it rather than rebuild.
- The user's persona is injected as context into the agent's prompt, not stored in a file the agent reads.
- Uploaded files go to a per-session temp directory that the agent can `Read`.
- Skills are the same `.claude/skills/*.md` files from the prototype, unmodified (with one small addition to session-start).
- The Agent SDK loads skills natively from the project directory. The system prompt instructs the agent to always begin with the session-start routing logic.

### Reusable template pattern

To deploy a different agent (e.g., the Neurodiversity Support Agent from project idea #5), a student would:

1. Replace the skills in `.claude/skills/`
2. Edit `agent-config.json` with their agent's name, description, and branding
3. Deploy

No backend or frontend code changes required.

---

## 2. Frontend Extensions to simple-chatapp

### What we keep as-is

- Chat message rendering (bubbles, streaming)
- WebSocket/SSE connection handling
- Input box and send mechanics
- Basic layout and styling

### What we add

**Branding header.** Agent name and one-line description, pulled from `agent-config.json`. For the Mindful Consumption agent: *"Mindful Consumption Guide — Helping you examine wants, resist persuasion, and find genuine flourishing."*

**Persona editor sidebar.** A collapsible panel where the user fills in:

- Name
- Age
- A free-text "About me" field (backstory, situation, what brings them here)
- Optional structured fields (e.g., current mood, what's on their mind)

The persona is sent to the backend as context before/with the first message. The user can edit it mid-session and the updated context applies to subsequent messages. The fields shown are driven by `agent-config.json`, so different agents can ask for different persona information.

**File upload.** A button or drag-drop zone. Files go to the server, get stored in a per-session temp directory. The agent is told about available files so it can `Read` them if relevant. Supported types: text, markdown, JSON, images.

**Config-driven customization.** A single `agent-config.json` controls:

- Agent name
- Description
- Color accent / theme
- Which persona fields to show
- Welcome message shown before the first interaction

---

## 3. Backend & Agent SDK Integration

### Session lifecycle

1. User loads the page. Frontend fetches config from `agent-config.json`. Renders branding and persona editor.
2. User fills in persona (or skips it) and sends first message.
3. Backend receives the message + persona data + any uploaded file references.
4. Backend constructs the Agent SDK `query()` call:
   - **System prompt:** Core personality and principles from session-start skill, plus instruction to always begin with the session-start routing logic.
   - **User message:** The persona context prepended to the user's actual message, e.g., `"[User context: Maya, 28, UX designer, stress-shops when overwhelmed] I've been feeling down and think I deserve a whole new wardrobe"`
   - **Skills:** Loaded natively from `.claude/skills/` via the SDK's project settings.
   - **Allowed tools:** `Skill`, `Read` (for uploaded files), and whatever the SDK needs for skill routing.
   - **Working directory:** Set to the project root so skills are discoverable, with uploaded files in a subdirectory.
5. Agent SDK streams responses back. Backend relays to frontend via the existing streaming mechanism.
6. Conversation continues. Each subsequent message includes the conversation history managed by the SDK's session.

### Persona injection

- The persona is NOT a file the agent reads — it's prepended as context to the user's messages.
- If the user updates their persona mid-conversation, the next message includes the updated context.
- Persona is optional. If the user skips it and sends a message directly, no context is prepended — the agent works fine without it, relying on what the user says in conversation.
- This keeps it simple and avoids file-management complexity.

### File upload handling

- Uploaded files stored in `./uploads/{session_id}/`.
- Agent is informed via system prompt addition: *"The user has uploaded the following files: [list with paths]. You can Read them if relevant."*
- Session temp directories cleaned up after inactivity (e.g., 1 hour).

### Session management (persistence-ready)

- Each session gets a UUID.
- In-memory for now (dict of `session_id` -> conversation state, persona, file list).
- Data model is clean enough to swap in SQLite or Redis later without restructuring.

---

## 4. Skills — What Changes, What Doesn't

### Unchanged (all 5 skills)

All skill markdown files stay exactly as they are:

| Skill | File | Purpose |
|-------|------|---------|
| session-start | `.claude/skills/session-start/SKILL.md` | Routes user intent to the right skill |
| want-examination | `.claude/skills/want-examination/SKILL.md` | Socratic questioning about purchase desires |
| reframe | `.claude/skills/reframe/SKILL.md` | Names persuasion techniques, offers alternatives |
| flourishing-prompt | `.claude/skills/flourishing-prompt/SKILL.md` | Scaled self-care exercises |
| gratitude-inventory | `.claude/skills/gratitude-inventory/SKILL.md` | Reflection on what's already good |

Their YAML frontmatter, question flows, transition points, tone guidance, and critical rules all stay the same. The routing logic in session-start that classifies intent and invokes the appropriate skill stays the same.

### One small addition to session-start

A note about the user persona context format so the agent knows to use it:

```markdown
## User Context
The user's self-described profile is prepended to their first message
in brackets. Use this to inform your tone and approach, but never
reference it mechanically ("I see you're 28 and a UX designer...").
Let it naturally shape how you engage.
```

### New: agent-config.json

Not a skill, but the deployment config at the project root:

```json
{
  "name": "Mindful Consumption Guide",
  "description": "Helping you examine wants, resist persuasion, and find genuine flourishing",
  "welcome_message": "Hi! I'm here to help you think through wants, navigate advertising pressure, or just check in on how you're doing. What's on your mind?",
  "accent_color": "#4A7C59",
  "persona_fields": [
    {"key": "name", "label": "Name", "type": "text", "required": false},
    {"key": "age", "label": "Age", "type": "number", "required": false},
    {"key": "about", "label": "About you", "type": "textarea", "placeholder": "What's going on in your life? What brings you here?", "required": false},
    {"key": "mood", "label": "Current mood", "type": "text", "required": false}
  ]
}
```

---

## 5. Deployment

### Platform: Fly.io

**Why Fly.io:**

- Simple CLI deploy (`fly launch` then `fly deploy`)
- Starts at ~$3/month for a small machine
- Free tier available for eventual migration to lower cost
- Good WebSocket support
- Machines auto-stop when idle (no traffic = no charge)

### Dockerfile

- Base image: Python 3.12 slim
- Install Claude Agent SDK + backend dependencies
- Copy the project (skills, config, frontend, backend code)
- Expose a single port
- Start the server

### Environment variables

- `ANTHROPIC_API_KEY` — the only required secret (set via `fly secrets set`)
- `PORT` — set by Fly.io automatically

### Cost control

- Fly.io machines auto-stop when idle
- Set `max_turns` on Agent SDK queries to cap runaway conversations
- Single machine is sufficient for class-scale usage

### Setup instructions (for DEPLOY.md)

The deployment guide will walk through:

1. **Create a Fly.io account** at https://fly.io/app/sign-up (GitHub login works)
2. **Install the Fly CLI:**
   - macOS: `brew install flyctl`
   - Linux: `curl -L https://fly.io/install.sh | sh`
   - Windows: `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"`
3. **Authenticate:** `fly auth login` (opens browser)
4. **Get an Anthropic API key** from https://console.anthropic.com/settings/keys
5. **Fork the template repo** and clone it locally
6. **First deploy:**
   ```bash
   cd your-agent-repo
   fly launch          # Creates the app, generates fly.toml
   fly secrets set ANTHROPIC_API_KEY=sk-ant-...
   fly deploy           # Builds and deploys
   ```
7. **Get your URL:** Fly.io assigns `https://your-app-name.fly.dev`
8. **Subsequent deploys:** Edit skills or config, then `fly deploy`
9. **Troubleshooting:**
   - `fly logs` — see server output
   - `fly ssh console` — shell into the running machine
   - `fly status` — check if the machine is running
   - Common issues: missing API key, port mismatch, skills directory not found

---

## 6. Template Structure & Student Guide

### Repo structure

```
├── README.md                    # What this is, how to try it, how to fork it
├── agent-config.json            # Agent branding + persona fields
├── .claude/skills/              # Agent skills (the agent's brain)
│   ├── session-start/SKILL.md
│   ├── want-examination/SKILL.md
│   ├── reframe/SKILL.md
│   ├── flourishing-prompt/SKILL.md
│   └── gratitude-inventory/SKILL.md
├── server/                      # Backend (students don't need to touch this)
│   ├── app.py                   # Main server
│   └── requirements.txt
├── static/                      # Frontend (students don't need to touch this)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── Dockerfile
├── fly.toml
├── data/                        # Personas, interactions (from prototype)
│   ├── personas/
│   └── interactions/
├── eval/                        # Evaluation code (from prototype)
└── docs/
    ├── DEPLOY.md                # Step-by-step deployment guide
    └── CUSTOMIZE.md             # How to make it your own agent
```

### What students touch

- `agent-config.json` — agent name, description, colors, persona fields, welcome message
- `.claude/skills/` — the agent's behavior, written in markdown

That's it for basic customization. No code changes required.

### What students don't touch

- `server/` — the backend infrastructure just works
- `static/` — the frontend just works
- `Dockerfile`, `fly.toml` — deployment config just works

Advanced students can modify these if they want more control.

### Documentation

**DEPLOY.md** covers:
- Full Fly.io setup from account creation through first deploy
- Setting the API key secret
- Updating after skill changes
- Troubleshooting common issues

**CUSTOMIZE.md** covers:
- Writing new skills (format, frontmatter, tone guidance, critical rules)
- Editing `agent-config.json` for branding and persona fields
- Testing locally before deploying (`python server/app.py` on `localhost:8000`)
- Adapting persona fields for your domain
- Tips from the Mindful Consumption agent experience

### Local development

```bash
pip install -r server/requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python server/app.py
# Open http://localhost:8000
```

---

## Summary

| Component | Source | Students modify? |
|-----------|--------|-----------------|
| Frontend | simple-chatapp fork + extensions | No (unless advanced) |
| Backend | simple-chatapp fork + extensions | No (unless advanced) |
| Skills | `.claude/skills/*.md` | Yes — this is the agent |
| Config | `agent-config.json` | Yes — branding + persona fields |
| Deployment | Dockerfile + fly.toml | No |
| Docs | DEPLOY.md + CUSTOMIZE.md | No (they read these) |
