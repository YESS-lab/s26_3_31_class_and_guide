import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";
import { loadSkills, buildSystemPrompt } from "./skill-loader.js";
import path from "path";
import type { PersonaData } from "./types.js";

// --- Load skills and build system prompt at module init ---
const SKILLS_DIR = path.resolve(".claude/skills");
const skills = loadSkills(SKILLS_DIR);
const SYSTEM_PROMPT = buildSystemPrompt(skills);

console.log(
  `[ai-client] Loaded ${skills.length} skills: ${skills.map((s) => s.name).join(", ")}`,
);

/**
 * AgentSession wraps the V2 Session API from the Claude Agent SDK.
 *
 * Each AgentSession corresponds to one long-lived conversational session
 * with the agent. It supports:
 *   - Creating a new session (constructor)
 *   - Resuming an existing session by ID (static `resume()`)
 *   - Sending messages with optional persona context and file references
 *   - Streaming SDK output messages
 */
export class AgentSession {
  private session: any; // SDK session object

  private constructor(session: any) {
    this.session = session;
  }

  /**
   * Create a brand-new agent session.
   */
  static create(): AgentSession {
    const session = unstable_v2_createSession({
      model: "sonnet",
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: ["Read"],
      maxTurns: 50,
      permissionMode: "bypassPermissions",
    });
    return new AgentSession(session);
  }

  /**
   * Resume an existing session by its ID.
   */
  static resume(sessionId: string): AgentSession {
    const session = unstable_v2_resumeSession(sessionId, {
      model: "sonnet",
      systemPrompt: SYSTEM_PROMPT,
      allowedTools: ["Read"],
      maxTurns: 50,
      permissionMode: "bypassPermissions",
    });
    return new AgentSession(session);
  }

  get sessionId(): string {
    return this.session.sessionId;
  }

  /**
   * Turn persona data into a bracketed context string for prepending to
   * user messages, e.g.:
   *   [User context: Maya, 28, UX designer, stress-shops when overwhelmed]
   */
  static formatPersonaContext(persona: PersonaData): string {
    const parts: string[] = [];
    for (const [, value] of Object.entries(persona)) {
      if (value !== undefined && value !== null && value !== "") {
        parts.push(String(value));
      }
    }
    if (parts.length === 0) return "";
    return `[User context: ${parts.join(", ")}] `;
  }

  /**
   * Send a user message to the agent.
   *
   * Optionally prepend persona context and file references so the agent
   * has that information available without the user needing to retype it.
   */
  async sendMessage(
    content: string,
    persona?: PersonaData,
    uploadedFiles?: string[],
  ) {
    let fullMessage = "";

    if (persona && Object.values(persona).some((v) => v)) {
      fullMessage += AgentSession.formatPersonaContext(persona);
    }

    if (uploadedFiles && uploadedFiles.length > 0) {
      fullMessage += `[Available files: ${uploadedFiles.join(", ")}] `;
    }

    fullMessage += content;

    await this.session.send(fullMessage);
  }

  /**
   * Async generator that yields SDK messages from the session output stream.
   */
  async *getOutputStream() {
    for await (const msg of this.session.stream()) {
      yield msg;
    }
  }

  /**
   * Close the underlying SDK session.
   */
  close() {
    this.session.close();
  }
}
