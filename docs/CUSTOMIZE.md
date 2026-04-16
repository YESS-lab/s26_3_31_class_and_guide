# Customizing Your Agent

This template deploys any conversational agent defined by Claude Code skills.
To make it your own, you only need to change two things:

1. **Skills** in `.claude/skills/` -- the agent's behavior
2. **Config** in `agent-config.json` -- the agent's branding and persona fields

You do NOT need to modify any TypeScript, React, or server code.

## Changing the Agent Config

Edit `agent-config.json` in the project root:

```json
{
  "name": "Your Agent Name",
  "description": "One line about what your agent does",
  "welcome_message": "The first thing users see before they send a message",
  "accent_color": "#hexcolor",
  "persona_fields": [
    {
      "key": "internal_field_name",
      "label": "What the user sees",
      "type": "text",
      "required": false,
      "placeholder": "Hint text in the input"
    }
  ]
}
```

**Field types:**
- `"text"` -- single-line text input
- `"number"` -- numeric input
- `"textarea"` -- multi-line text input

**Persona fields** depend on your agent's domain. Examples:

- Mindful Consumption Agent: name, age, about, mood
- Neurodiversity Support Agent: name, diagnosis/identity, current challenge, energy level
- Career Agent: name, field, years of experience, what they're looking for

## Writing Skills

Skills live in `.claude/skills/`, one directory per skill:

```
.claude/skills/
  your-skill-name/
    SKILL.md
```

Each `SKILL.md` has this format:

```markdown
---
name: your-skill-name
description: When this skill should be used (one sentence)
---

# Skill Title

Instructions for the agent when this skill is active.
Include: approach, tone, question flow, transition points,
and critical rules (what NOT to do).
```

### Required: session-start skill

Every agent needs a `session-start` skill that:
1. Classifies the user's intent from their opening message
2. Routes to the appropriate skill
3. Defines the agent's core personality

Look at `.claude/skills/session-start/SKILL.md` in this repo for
a working example.

### Tips from the Mindful Consumption Agent

1. **Be specific about tone.** "Conspiratorial, not preachy" beats "be friendly."
2. **Include Critical Rules.** Every skill should say what the agent must
   NOT do. Without these, the LLM defaults to generic assistant behavior.
3. **One question at a time.** If your agent asks questions, say so explicitly
   in the skill: "Ask one question. Wait. Follow the thread."
4. **Define transitions.** How does the agent move between skills? Put a
   transition table in each skill.
5. **Start with 3-5 skills.** A router, 2-3 core skills, and a session
   closer. Add more after testing.

## Testing Locally

Before deploying, test your changes locally:

```bash
npm install                           # First time only
export ANTHROPIC_API_KEY=sk-ant-...   # Your API key
npm run dev
```

Open http://localhost:5173 and interact with your agent. Check:
- Does the branding look right?
- Does the persona editor show your fields?
- Does the agent follow your skills?
- Does it route correctly based on different opening messages?

## Deploying Changes

After testing locally:

```bash
fly deploy
```

Changes go live in about a minute.
