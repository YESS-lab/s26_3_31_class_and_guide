import { query } from "@anthropic-ai/claude-agent-sdk";
import type { PersonaData } from "./types.js";

type UserMessage = {
  type: "user";
  message: { role: "user"; content: string };
};

/**
 * Async message queue for multi-turn conversations.
 * Messages go in via push(), come out via async iteration.
 * This is the standard pattern from the simple-chatapp demo.
 */
class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: UserMessage = {
      type: "user",
      message: { role: "user", content },
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

/**
 * AgentSession wraps the Claude Agent SDK query() with project settings.
 *
 * Uses settingSources: ['project'] so the SDK loads:
 *   - .claude/skills/ (skill discovery and invocation)
 *   - .claude/settings.json (tool permissions)
 *   - CLAUDE.md (agent behavior instructions)
 *
 * This wrapper adds persona context injection on top.
 */
export class AgentSession {
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<any> | null = null;

  constructor() {
    this.outputIterator = query({
      prompt: this.queue as any,
      options: {
        maxTurns: 50,
        model: "sonnet",
        settingSources: ["project"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    })[Symbol.asyncIterator]();
  }

  /**
   * Turn persona data into a bracketed context string prepended to messages.
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
   * Send a message to the agent with optional persona context.
   */
  sendMessage(
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
    this.queue.push(fullMessage);
  }

  /**
   * Async generator yielding SDK messages from the output stream.
   */
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
