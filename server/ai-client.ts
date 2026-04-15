import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";
import type { PersonaData } from "./types.js";

/**
 * AgentSession wraps the V2 Session API from the Claude Agent SDK.
 *
 * The SDK handles skill discovery, tool permissions, and system prompt
 * automatically from the project's .claude/ directory and CLAUDE.md.
 * This wrapper only adds persona context injection.
 */
export class AgentSession {
  private session: any;

  private constructor(session: any) {
    this.session = session;
  }

  static create(): AgentSession {
    const session = unstable_v2_createSession({
      model: "sonnet",
    });
    return new AgentSession(session);
  }

  static resume(sessionId: string): AgentSession {
    const session = unstable_v2_resumeSession(sessionId, {
      model: "sonnet",
    });
    return new AgentSession(session);
  }

  get sessionId(): string {
    return this.session.sessionId;
  }

  /**
   * Turn persona data into a bracketed context string prepended to messages.
   * e.g. [User context: Maya, 28, UX designer, stress-shops when overwhelmed]
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

  async *getOutputStream() {
    for await (const msg of this.session.stream()) {
      yield msg;
    }
  }

  close() {
    this.session.close();
  }
}
