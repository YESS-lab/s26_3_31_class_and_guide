# Deployable Agent via Claude Agent SDK — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Mindful Consumption Agent as a web app using the Claude Agent SDK, based on the simple-chatapp demo, with persona editing, file uploads, and a reusable template for other agents.

**Architecture:** Fork the [simple-chatapp](https://github.com/anthropics/claude-agent-sdk-demos/tree/main/simple-chatapp) (Express + React + WebSocket). Replace the generic system prompt with a skill-composed prompt built from `.claude/skills/` at startup. Add persona editor sidebar, file upload, and config-driven branding. Deploy via Docker on Fly.io.

**Tech Stack:** TypeScript, Express, React, Tailwind CSS, Vite, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), WebSocket (`ws`), Docker, Fly.io

**Note on language choice:** The spec originally said Python, but the simple-chatapp is TypeScript. We keep TypeScript since we're extending the existing demo rather than rewriting it. Students interact with markdown skill files and JSON config — they don't need to understand the TypeScript.

---

## File Structure (new/modified files only)

```
├── agent-config.json                    # NEW: Agent branding + persona fields
├── .claude/skills/                      # COPIED: From prototype repo (5 skills)
│   ├── session-start/SKILL.md           # MODIFIED: Add user context note
│   ├── want-examination/SKILL.md
│   ├── reframe/SKILL.md
│   ├── flourishing-prompt/SKILL.md
│   └── gratitude-inventory/SKILL.md
├── server/
│   ├── ai-client.ts                     # MODIFIED: Skill-composed prompt, tools, persona
│   ├── skill-loader.ts                  # NEW: Reads skills, builds system prompt
│   ├── server.ts                        # MODIFIED: Config endpoint, file upload
│   ├── session.ts                       # MODIFIED: Persona injection, file tracking
│   └── types.ts                         # MODIFIED: Persona + config types
├── client/
│   ├── App.tsx                          # MODIFIED: Config loading, persona state, branding
│   ├── components/
│   │   ├── ChatWindow.tsx               # MODIFIED: Welcome message, file upload button
│   │   ├── ChatList.tsx                 # MODIFIED: Branding header
│   │   ├── PersonaEditor.tsx            # NEW: Persona sidebar
│   │   └── FileUpload.tsx               # NEW: File upload widget
│   └── globals.css                      # MODIFIED: Accent color CSS variable
├── Dockerfile                           # NEW
├── fly.toml                             # NEW
├── docs/
│   ├── DEPLOY.md                        # NEW
│   └── CUSTOMIZE.md                     # NEW
└── uploads/                             # CREATED AT RUNTIME: Per-session file storage
```

---

## Phase 1: Project Setup

### Task 1: Clone simple-chatapp and verify it runs

**Files:**
- Create: entire project directory (cloned from GitHub)

- [ ] **Step 1: Clone the simple-chatapp demo**

```bash
cd /Users/glnelson/dev/s26_spike/s26_3_31_class_and_guide
git clone https://github.com/anthropics/claude-agent-sdk-demos.git /tmp/claude-agent-sdk-demos
cp -r /tmp/claude-agent-sdk-demos/simple-chatapp/* .
cp /tmp/claude-agent-sdk-demos/simple-chatapp/.gitignore ./.chatapp-gitignore
rm -rf /tmp/claude-agent-sdk-demos
```

- [ ] **Step 2: Merge .gitignore entries**

Append the simple-chatapp's gitignore entries to the existing `.gitignore`:

```
# simple-chatapp
node_modules/
dist/
uploads/
.env
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Verify it runs**

```bash
export ANTHROPIC_API_KEY=sk-ant-...  # Use real key
npm run dev
```

Expected: Backend on `http://localhost:3001`, frontend on `http://localhost:5173`. Open browser, create a chat, send a message, get a response.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts postcss.config.js tailwind.config.js server/ client/ .gitignore
git commit -m "feat: add simple-chatapp as base for deployed agent"
```

---

### Task 2: Copy skills into the project

**Files:**
- Verify: `.claude/skills/session-start/SKILL.md` (and 4 others already exist)

The skills already exist in this repo at `.claude/skills/`. No copy needed.

- [ ] **Step 1: Verify skills are present**

```bash
ls .claude/skills/*/SKILL.md
```

Expected: 5 files listed (session-start, want-examination, reframe, flourishing-prompt, gratitude-inventory).

- [ ] **Step 2: No action needed — skills are already in place**

---

### Task 3: Create agent-config.json

**Files:**
- Create: `agent-config.json`

- [ ] **Step 1: Create the config file**

```json
{
  "name": "Mindful Consumption Guide",
  "description": "Helping you examine wants, resist persuasion, and find genuine flourishing",
  "welcome_message": "Hi! I'm here to help you think through wants, navigate advertising pressure, or just check in on how you're doing. What's on your mind?",
  "accent_color": "#4A7C59",
  "persona_fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "required": false,
      "placeholder": "What should I call you?"
    },
    {
      "key": "age",
      "label": "Age",
      "type": "number",
      "required": false,
      "placeholder": ""
    },
    {
      "key": "about",
      "label": "About you",
      "type": "textarea",
      "required": false,
      "placeholder": "What's going on in your life? What brings you here?"
    },
    {
      "key": "mood",
      "label": "Current mood",
      "type": "text",
      "required": false,
      "placeholder": "How are you feeling right now?"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add agent-config.json
git commit -m "feat: add agent-config.json for branding and persona fields"
```

---

## Phase 2: Backend — Agent SDK Integration

### Task 4: Create skill-loader.ts

This module reads all `.claude/skills/*/SKILL.md` files at startup and composes them into a single system prompt. This is the core translation layer — skills written as Claude Code skill files become the agent's system prompt.

**Files:**
- Create: `server/skill-loader.ts`

- [ ] **Step 1: Write the skill loader**

```typescript
// server/skill-loader.ts
import fs from "fs";
import path from "path";

interface SkillMeta {
  name: string;
  description: string;
  content: string;
}

function parseSkillFile(filePath: string): SkillMeta | null {
  const raw = fs.readFileSync(filePath, "utf-8");

  // Parse YAML frontmatter
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const content = frontmatterMatch[2].trim();

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim() ?? path.basename(path.dirname(filePath)),
    description: descMatch?.[1]?.trim() ?? "",
    content,
  };
}

export function loadSkills(skillsDir: string): SkillMeta[] {
  if (!fs.existsSync(skillsDir)) return [];

  const skills: SkillMeta[] = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

    const skill = parseSkillFile(skillFile);
    if (skill) skills.push(skill);
  }

  return skills;
}

export function buildSystemPrompt(skills: SkillMeta[]): string {
  const sessionStart = skills.find((s) => s.name === "session-start");
  const otherSkills = skills.filter((s) => s.name !== "session-start");

  let prompt = "";

  // Session-start forms the core personality and routing
  if (sessionStart) {
    prompt += sessionStart.content + "\n\n";
  }

  // Add transition instructions
  prompt += `## Skill Transitions

When the conversation calls for transitioning to a different skill (e.g., the session-start routing table says to use want-examination), switch to following the instructions in that skill's section below. Transitions referenced as "/skill-name" mean: follow the instructions in the corresponding section below.

`;

  // Append each skill as a section
  for (const skill of otherSkills) {
    prompt += `---\n\n`;
    prompt += skill.content + "\n\n";
  }

  return prompt.trim();
}
```

- [ ] **Step 2: Verify it loads skills correctly**

```bash
npx tsx -e "
import { loadSkills, buildSystemPrompt } from './server/skill-loader.js';
const skills = loadSkills('.claude/skills');
console.log('Loaded skills:', skills.map(s => s.name));
console.log('Prompt length:', buildSystemPrompt(skills).length, 'chars');
console.log('First 200 chars:', buildSystemPrompt(skills).substring(0, 200));
"
```

Expected: Lists 5 skill names, shows prompt length (should be several thousand chars), and preview showing the session-start content.

- [ ] **Step 3: Commit**

```bash
git add server/skill-loader.ts
git commit -m "feat: add skill-loader to compose system prompt from .claude/skills/"
```

---

### Task 5: Add persona and config types

**Files:**
- Modify: `server/types.ts`

- [ ] **Step 1: Add new types to types.ts**

Add these types after the existing type definitions:

```typescript
// Persona and config types for the deployed agent

export interface PersonaField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  required: boolean;
  placeholder?: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  welcome_message: string;
  accent_color: string;
  persona_fields: PersonaField[];
}

export interface PersonaData {
  [key: string]: string | number | undefined;
}

export interface UploadedFile {
  originalName: string;
  storedPath: string;
  uploadedAt: string;
}

// Extend WSChatMessage to include persona
export interface WSChatMessageWithPersona extends WSChatMessage {
  persona?: PersonaData;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/types.ts
git commit -m "feat: add persona, config, and file upload types"
```

---

### Task 6: Modify ai-client.ts for the mindful consumption agent

**Files:**
- Modify: `server/ai-client.ts`

- [ ] **Step 1: Replace the system prompt and tools configuration**

Replace the entire `ai-client.ts` content. Key changes from original:
- System prompt built from skills instead of hardcoded
- Allowed tools narrowed to `Read` only (agent reads uploaded files; skills are in the prompt, not invoked as tools)
- Model set to `sonnet` (cheaper for conversational agent)
- Persona context method added

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { loadSkills, buildSystemPrompt } from "./skill-loader.js";
import path from "path";

// Build system prompt from skills at module load time
const SKILLS_DIR = path.resolve(".claude/skills");
const skills = loadSkills(SKILLS_DIR);
const SYSTEM_PROMPT = buildSystemPrompt(skills);

console.log(
  `[ai-client] Loaded ${skills.length} skills: ${skills.map((s) => s.name).join(", ")}`
);

type UserMessage = {
  type: "user";
  message: { role: "user"; content: string };
};

// Simple async queue — messages go in via push(), come out via async iteration
class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: UserMessage = {
      type: "user",
      message: {
        role: "user",
        content,
      },
    };

    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<UserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        yield await new Promise<UserMessage>((resolve) => {
          this.waiting = resolve;
        });
      }
    }
  }

  close() {
    this.closed = true;
  }
}

export class AgentSession {
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<any> | null = null;
  private uploadDir: string;

  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;

    // Build the full system prompt including file upload awareness
    let systemPrompt = SYSTEM_PROMPT;
    // Upload dir awareness will be added per-message if files exist

    this.outputIterator = query({
      prompt: this.queue as any,
      options: {
        maxTurns: 50,
        model: "sonnet",
        allowedTools: ["Read"],
        systemPrompt: systemPrompt,
      },
    })[Symbol.asyncIterator]();
  }

  // Format persona data as a bracketed context string
  static formatPersonaContext(persona: Record<string, any>): string {
    const parts: string[] = [];
    if (persona.name) parts.push(persona.name);
    if (persona.age) parts.push(`${persona.age} years old`);
    if (persona.about) parts.push(persona.about);
    if (persona.mood) parts.push(`feeling ${persona.mood}`);
    // Include any other fields
    for (const [key, value] of Object.entries(persona)) {
      if (!["name", "age", "about", "mood"].includes(key) && value) {
        parts.push(`${key}: ${value}`);
      }
    }
    if (parts.length === 0) return "";
    return `[User context: ${parts.join(", ")}] `;
  }

  // Send a message to the agent, optionally with persona context
  sendMessage(content: string, persona?: Record<string, any>, uploadedFiles?: string[]) {
    let fullMessage = "";

    // Prepend persona context if provided
    if (persona && Object.values(persona).some((v) => v)) {
      fullMessage += AgentSession.formatPersonaContext(persona);
    }

    // Append file awareness if files exist
    if (uploadedFiles && uploadedFiles.length > 0) {
      fullMessage += `[Available files: ${uploadedFiles.join(", ")}] `;
    }

    fullMessage += content;
    this.queue.push(fullMessage);
  }

  async *getOutputStream() {
    if (!this.outputIterator) {
      throw new Error("Session not initialized");
    }
    while (true) {
      const { value, done } = await this.outputIterator.next();
      if (done) break;
      yield value;
    }
  }

  close() {
    this.queue.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/ai-client.ts
git commit -m "feat: replace generic AI client with skill-composed mindful consumption agent"
```

---

### Task 7: Modify server.ts — config endpoint and file upload

**Files:**
- Modify: `server/server.ts`

- [ ] **Step 1: Add imports for file handling and config**

Add near the top of `server.ts`, after existing imports:

```typescript
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AgentConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve("uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Load agent config
const configPath = path.resolve("agent-config.json");
const agentConfig: AgentConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
console.log(`[server] Agent: ${agentConfig.name}`);
```

- [ ] **Step 2: Add config API endpoint**

Add after the existing REST endpoints (after the `DELETE /api/chats/:id` handler):

```typescript
// Serve agent config
app.get("/api/config", (_req, res) => {
  res.json(agentConfig);
});
```

- [ ] **Step 3: Add file upload endpoint**

Add after the config endpoint. Uses raw body parsing since we want to keep dependencies minimal:

```typescript
// File upload — stores files in uploads/{sessionId}/
app.post("/api/upload/:sessionId", express.raw({ type: "*/*", limit: "10mb" }), (req, res) => {
  const { sessionId } = req.params;
  const fileName = req.headers["x-filename"] as string;
  if (!fileName) {
    res.status(400).json({ error: "Missing X-Filename header" });
    return;
  }

  const sessionDir = path.join(UPLOADS_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Sanitize filename
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(sessionDir, safeName);
  fs.writeFileSync(filePath, req.body);

  res.json({
    originalName: fileName,
    storedPath: filePath,
    uploadedAt: new Date().toISOString(),
  });
});

// List uploaded files for a session
app.get("/api/uploads/:sessionId", (req, res) => {
  const sessionDir = path.join(UPLOADS_DIR, req.params.sessionId);
  if (!fs.existsSync(sessionDir)) {
    res.json([]);
    return;
  }
  const files = fs.readdirSync(sessionDir).map((name) => ({
    originalName: name,
    storedPath: path.join(sessionDir, name),
  }));
  res.json(files);
});
```

- [ ] **Step 4: Commit**

```bash
git add server/server.ts
git commit -m "feat: add config endpoint and file upload handling to server"
```

---

### Task 8: Modify session.ts for persona injection

**Files:**
- Modify: `server/session.ts`

- [ ] **Step 1: Update session to accept persona and track files**

The session class needs to:
1. Accept persona data when sending messages
2. Track uploaded files per session
3. Pass both to `AgentSession.sendMessage()`

Find where `sendMessage` is called in `session.ts` and update it to pass persona and file info. The specific changes depend on the exact current code, but the pattern is:

In the `Session` class, add properties:

```typescript
private persona: Record<string, any> = {};
private uploadedFiles: string[] = [];
```

Add methods:

```typescript
setPersona(persona: Record<string, any>) {
  this.persona = persona;
}

addUploadedFile(filePath: string) {
  this.uploadedFiles.push(filePath);
}
```

Update the `sendMessage` call to pass persona and files:

```typescript
// Where the session forwards user content to the agent:
this.agent.sendMessage(content, this.persona, this.uploadedFiles);
```

- [ ] **Step 2: Update WebSocket message handling in server.ts**

In `server.ts`, where incoming WS `chat` messages are handled, extract persona data:

```typescript
// When processing a "chat" message:
if (msg.persona) {
  session.setPersona(msg.persona);
}
```

- [ ] **Step 3: Commit**

```bash
git add server/session.ts server/server.ts
git commit -m "feat: wire persona and file upload data through session to agent"
```

---

## Phase 3: Frontend — UI Extensions

### Task 9: Update session-start skill with user context note

**Files:**
- Modify: `.claude/skills/session-start/SKILL.md`

- [ ] **Step 1: Add user context section**

Add this section before the `## Core Principles` section in session-start/SKILL.md:

```markdown
## User Context

The user's self-described profile may be prepended to their first message in brackets, like: `[User context: Maya, 28, UX designer, stress-shops when overwhelmed]`. Use this to inform your tone and approach, but never reference it mechanically ("I see you're 28 and a UX designer..."). Let it naturally shape how you engage. If no user context is provided, that's fine — work with what the user tells you in conversation.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/session-start/SKILL.md
git commit -m "feat: add user context instructions to session-start skill"
```

---

### Task 10: Create PersonaEditor component

**Files:**
- Create: `client/components/PersonaEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";

interface PersonaField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  required: boolean;
  placeholder?: string;
}

interface PersonaEditorProps {
  fields: PersonaField[];
  persona: Record<string, any>;
  onPersonaChange: (persona: Record<string, any>) => void;
  accentColor: string;
}

export default function PersonaEditor({
  fields,
  persona,
  onPersonaChange,
  accentColor,
}: PersonaEditorProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleChange = (key: string, value: string | number) => {
    onPersonaChange({ ...persona, [key]: value });
  };

  return (
    <div className="bg-gray-800 border-r border-gray-700 flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-3 text-sm font-medium text-gray-300 hover:text-white"
      >
        <span>About You</span>
        <span className="text-xs">{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3 overflow-y-auto">
          <p className="text-xs text-gray-500">
            Optional — helps the agent understand your context.
          </p>
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-gray-400 mb-1">
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  value={persona[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-1"
                  style={{ focusRingColor: accentColor } as any}
                />
              ) : (
                <input
                  type={field.type}
                  value={persona[field.key] || ""}
                  onChange={(e) =>
                    handleChange(
                      field.key,
                      field.type === "number"
                        ? parseInt(e.target.value) || ""
                        : e.target.value
                    )
                  }
                  placeholder={field.placeholder}
                  className="w-full bg-gray-700 text-white text-sm rounded px-2 py-1.5 placeholder-gray-500 focus:outline-none focus:ring-1"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/components/PersonaEditor.tsx
git commit -m "feat: add PersonaEditor sidebar component"
```

---

### Task 11: Create FileUpload component

**Files:**
- Create: `client/components/FileUpload.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useRef, useState } from "react";

interface FileUploadProps {
  sessionId: string | null;
  onFileUploaded: (file: { originalName: string; storedPath: string }) => void;
}

export default function FileUpload({ sessionId, onFileUploaded }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    setUploading(true);
    try {
      const res = await fetch(`/api/upload/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Filename": file.name,
        },
        body: file,
      });
      const result = await res.json();
      onFileUploaded(result);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleUpload}
        className="hidden"
        accept=".txt,.md,.json,.csv,.png,.jpg,.jpeg,.gif,.pdf"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={!sessionId || uploading}
        className="p-2 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
        title={uploading ? "Uploading..." : "Upload a file"}
      >
        {uploading ? "⏳" : "📎"}
      </button>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/components/FileUpload.tsx
git commit -m "feat: add FileUpload component"
```

---

### Task 12: Modify App.tsx — config, persona, branding

**Files:**
- Modify: `client/App.tsx`

This is the largest frontend change. The modifications:

1. Fetch `agent-config.json` on load
2. Manage persona state
3. Pass persona with each chat message via WebSocket
4. Show branding header
5. Include PersonaEditor in the layout
6. Track uploaded files

- [ ] **Step 1: Add config and persona state**

Near the top of the `App` component function, add:

```typescript
const [config, setConfig] = useState<any>(null);
const [persona, setPersona] = useState<Record<string, any>>({});
const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
```

- [ ] **Step 2: Add config fetch effect**

Add a `useEffect` to load the config:

```typescript
useEffect(() => {
  fetch("/api/config")
    .then((res) => res.json())
    .then((data) => setConfig(data))
    .catch((err) => console.error("Failed to load config:", err));
}, []);
```

- [ ] **Step 3: Modify the send-message handler to include persona**

Where the WebSocket `chat` message is sent, include persona data:

```typescript
// In the handleSendMessage function, modify the WS send:
sendMessage(JSON.stringify({
  type: "chat",
  chatId: selectedChatId,
  content: message,
  persona: persona,  // Add this
}));
```

- [ ] **Step 4: Add PersonaEditor to the layout**

Import and render the PersonaEditor in the sidebar area:

```tsx
import PersonaEditor from "./components/PersonaEditor";
import FileUpload from "./components/FileUpload";

// In the JSX, add PersonaEditor below the ChatList in the sidebar:
{config && (
  <PersonaEditor
    fields={config.persona_fields}
    persona={persona}
    onPersonaChange={setPersona}
    accentColor={config.accent_color}
  />
)}
```

- [ ] **Step 5: Add branding header**

At the top of the main layout, before the chat area:

```tsx
{config && (
  <div className="p-3 border-b border-gray-700 bg-gray-800">
    <h1 className="text-lg font-semibold text-white">{config.name}</h1>
    <p className="text-xs text-gray-400">{config.description}</p>
  </div>
)}
```

- [ ] **Step 6: Pass welcome message and file upload to ChatWindow**

```tsx
<ChatWindow
  messages={messages}
  onSendMessage={handleSendMessage}
  isConnected={isConnected}
  isLoading={isLoading}
  welcomeMessage={config?.welcome_message}
  sessionId={selectedChatId}
  onFileUploaded={(file) => setUploadedFiles((prev) => [...prev, file.storedPath])}
/>
```

- [ ] **Step 7: Commit**

```bash
git add client/App.tsx
git commit -m "feat: integrate config, persona, and branding into App"
```

---

### Task 13: Modify ChatWindow.tsx — welcome message and file upload

**Files:**
- Modify: `client/components/ChatWindow.tsx`

- [ ] **Step 1: Add welcome message and file upload props**

Update the component props interface:

```typescript
interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isConnected: boolean;
  isLoading: boolean;
  welcomeMessage?: string;
  sessionId: string | null;
  onFileUploaded?: (file: { originalName: string; storedPath: string }) => void;
}
```

- [ ] **Step 2: Replace the empty state with the welcome message**

Find the empty-state / "no messages" placeholder and replace with:

```tsx
{messages.length === 0 && (
  <div className="flex-1 flex items-center justify-center p-8">
    <p className="text-gray-400 text-center max-w-md">
      {welcomeMessage || "Send a message to get started."}
    </p>
  </div>
)}
```

- [ ] **Step 3: Add FileUpload button next to the input**

Import FileUpload and add it next to the send button in the input area:

```tsx
import FileUpload from "./FileUpload";

// In the input bar, next to the text input:
<FileUpload
  sessionId={sessionId}
  onFileUploaded={(file) => onFileUploaded?.(file)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add client/components/ChatWindow.tsx
git commit -m "feat: add welcome message and file upload to ChatWindow"
```

---

### Task 14: Add accent color CSS variable

**Files:**
- Modify: `client/globals.css`

- [ ] **Step 1: Add CSS custom property**

Add to the existing globals.css:

```css
:root {
  --accent-color: #4A7C59;
}

/* Accent color utilities */
.accent-border { border-color: var(--accent-color); }
.accent-bg { background-color: var(--accent-color); }
.accent-text { color: var(--accent-color); }
```

The accent color from config is applied via inline styles in components that need it, with CSS variable as fallback.

- [ ] **Step 2: Commit**

```bash
git add client/globals.css
git commit -m "feat: add accent color CSS variable"
```

---

## Phase 4: Deployment

### Task 15: Create Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

# Expose port
ENV PORT=3001
EXPOSE 3001

# Start server (serves built frontend from dist/)
CMD ["npx", "tsx", "server/server.ts"]
```

- [ ] **Step 2: Add .dockerignore**

Create `.dockerignore`:

```
node_modules
dist
uploads
.git
.DS_Store
.entire
```

- [ ] **Step 3: Test Docker build locally**

```bash
docker build -t mindful-agent .
docker run -p 3001:3001 -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY mindful-agent
```

Expected: Opens at `http://localhost:3001`, shows the branded agent, can chat.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add Dockerfile for deployment"
```

---

### Task 16: Create fly.toml

**Files:**
- Create: `fly.toml`

- [ ] **Step 1: Write fly.toml**

```toml
app = "mindful-consumption-guide"
primary_region = "bos"

[build]

[env]
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

Note: `primary_region = "bos"` (Boston) is chosen for proximity to UMaine. Students deploying their own agents can change this.

- [ ] **Step 2: Commit**

```bash
git add fly.toml
git commit -m "feat: add fly.toml for Fly.io deployment"
```

---

### Task 17: Write DEPLOY.md

**Files:**
- Create: `docs/DEPLOY.md`

- [ ] **Step 1: Write the deployment guide**

```markdown
# Deploying Your Agent

This guide walks you through deploying your agent to the web using Fly.io.
After following these steps, you'll have a public URL anyone can use to
interact with your agent.

## Prerequisites

- A GitHub account (you should already have this)
- An Anthropic API key from https://console.anthropic.com/settings/keys
  (you should already have this from class)

## Step 1: Create a Fly.io Account

1. Go to https://fly.io/app/sign-up
2. Sign up with your GitHub account (easiest option)
3. You'll need to add a credit card for verification, but the free tier
   covers small apps. A small agent like this costs ~$3-5/month if left
   running, and $0 when stopped.

## Step 2: Install the Fly CLI

**macOS (Homebrew):**
```bash
brew install flyctl
```

**macOS/Linux (curl):**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

After installing, verify it works:
```bash
fly version
```

## Step 3: Log In

```bash
fly auth login
```

This opens your browser. Log in with the same account you created in Step 1.

## Step 4: Deploy

From your project directory (the one with `fly.toml`):

```bash
# First time only — creates the app on Fly.io
fly launch --no-deploy

# Set your Anthropic API key as a secret
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Deploy
fly deploy
```

The first deploy takes 2-3 minutes. Fly.io builds your Docker container
in the cloud and starts it.

## Step 5: Get Your URL

After deploy completes, your agent is live at:

```
https://your-app-name.fly.dev
```

The exact URL is shown in the deploy output. Share this link with anyone
who should be able to use your agent.

## Updating Your Agent

After changing skills or config:

```bash
fly deploy
```

That's it. Changes go live in ~1 minute.

## Useful Commands

```bash
fly logs          # See server output (useful for debugging)
fly status        # Check if your app is running
fly ssh console   # Shell into the running machine
fly apps destroy your-app-name  # Delete the app entirely
```

## Troubleshooting

**"Error: no machines" or app won't start**
- Check `fly logs` for error messages
- Most common: missing ANTHROPIC_API_KEY. Run `fly secrets set` again.

**"Cannot connect" in the browser**
- The app may have auto-stopped. Just refresh — it auto-starts on traffic.
  First request after a stop takes ~10 seconds.

**Agent doesn't respond or gives generic responses**
- Check that `.claude/skills/` is in the repo and not in `.gitignore`
- Check `fly logs` for "Loaded N skills" — should show 5 (or however
  many you have)

**File uploads fail**
- Max file size is 10MB
- Check that the uploads directory is writable (it should be by default)

## Cost

- Fly.io machines auto-stop when idle (no traffic = no charge)
- When running: ~$3-5/month for a small machine
- API costs depend on usage — each conversation uses Anthropic API tokens
- For class purposes, this should be well within your API budget
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: add step-by-step Fly.io deployment guide"
```

---

### Task 18: Write CUSTOMIZE.md

**Files:**
- Create: `docs/CUSTOMIZE.md`

- [ ] **Step 1: Write the customization guide**

```markdown
# Customizing Your Agent

This template deploys any conversational agent defined by Claude Code skills.
To make it your own, you only need to change two things:

1. **Skills** in `.claude/skills/` — the agent's behavior
2. **Config** in `agent-config.json` — the agent's branding and persona fields

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
      "type": "text | number | textarea",
      "required": false,
      "placeholder": "Hint text in the input"
    }
  ]
}
```

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
```

- [ ] **Step 2: Commit**

```bash
git add docs/CUSTOMIZE.md
git commit -m "docs: add customization guide for student agents"
```

---

## Phase 5: Verification

### Task 19: End-to-end local test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify branding**

Open `http://localhost:5173`. Check:
- Agent name "Mindful Consumption Guide" appears in the header
- Description appears below the name
- Welcome message appears in the chat area before any messages

- [ ] **Step 3: Verify persona editor**

- Sidebar shows "About You" section with 4 fields (Name, Age, About you, Current mood)
- Fields are editable
- Collapsible via the toggle button

- [ ] **Step 4: Test a conversation**

Fill in persona: Name = "Maya", About = "UX designer, stress-shops when overwhelmed"

Send: "I've been feeling down and think I deserve a whole new wardrobe"

Check:
- Agent responds with warm, non-judgmental tone
- Agent asks a question (not lectures)
- Response is consistent with the want-examination skill

- [ ] **Step 5: Test file upload**

Click the upload button, attach a text file. Send a message referencing the file.
Check: Agent acknowledges the file and can discuss its contents.

- [ ] **Step 6: Test routing**

Start a new chat. Send: "I keep seeing ads for things I don't need and it's getting to me"
Check: Agent responds with reframe-style response (names the persuasion technique).

Start a new chat. Send: "I'm feeling really stressed and burned out"
Check: Agent responds with flourishing-prompt style (acknowledges feeling, asks about capacity).

- [ ] **Step 7: Verify server logs**

Check terminal output for:
```
[ai-client] Loaded 5 skills: session-start, want-examination, reframe, flourishing-prompt, gratitude-inventory
[server] Agent: Mindful Consumption Guide
```

---

### Task 20: Deploy to Fly.io

- [ ] **Step 1: Launch on Fly.io**

```bash
fly launch --no-deploy
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
fly deploy
```

- [ ] **Step 2: Verify deployment**

Open the Fly.io URL (shown in deploy output). Run through the same checks from Task 19:
- Branding appears
- Persona editor works
- Can have a conversation
- Agent follows skills

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete deployable agent via Claude Agent SDK"
```
