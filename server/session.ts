import type { WSClient, PersonaData } from "./types.js";
import { AgentSession } from "./ai-client.js";
import { chatStore } from "./chat-store.js";

/**
 * Session manages a single chat conversation with a long-lived agent.
 *
 * The agent uses query() with a MessageQueue, so the output stream stays
 * alive across multiple turns. We start listening once and messages flow
 * through as the user sends them.
 */
export class Session {
  public readonly chatId: string;
  private subscribers: Set<WSClient> = new Set();
  private agentSession: AgentSession;
  private isListening = false;

  // Per-session persona and uploaded file tracking
  private persona: PersonaData | undefined;
  private uploadedFiles: string[] = [];

  constructor(chatId: string) {
    this.chatId = chatId;
    this.agentSession = new AgentSession();
  }

  setPersona(persona: PersonaData) {
    this.persona = persona;
  }

  addUploadedFile(filePath: string) {
    if (!this.uploadedFiles.includes(filePath)) {
      this.uploadedFiles.push(filePath);
    }
  }

  /**
   * Start listening to the agent output stream. Called once —
   * the stream stays alive across all turns because the underlying
   * MessageQueue keeps yielding as new messages are pushed.
   */
  private async startListening() {
    if (this.isListening) return;
    this.isListening = true;

    try {
      for await (const message of this.agentSession.getOutputStream()) {
        this.handleSDKMessage(message);
      }
    } catch (error) {
      console.error(`Error in session ${this.chatId}:`, error);
      this.broadcastError((error as Error).message);
    }
  }

  sendMessage(content: string, persona?: PersonaData) {
    chatStore.addMessage(this.chatId, { role: "user", content });

    this.broadcast({
      type: "user_message",
      content,
      chatId: this.chatId,
    });

    const effectivePersona = persona || this.persona;

    this.agentSession.sendMessage(
      content,
      effectivePersona,
      this.uploadedFiles.length > 0 ? this.uploadedFiles : undefined,
    );

    if (!this.isListening) {
      this.startListening();
    }
  }

  private handleSDKMessage(message: any) {
    if (message.type === "stream_event") {
      // Partial streaming message — broadcast text deltas for live typing
      const event = message.event;
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        this.broadcast({
          type: "assistant_delta",
          content: event.delta.text,
          chatId: this.chatId,
        });
      }
    } else if (message.type === "assistant") {
      // Complete assistant message — store in chat history
      const content = message.message.content;

      if (typeof content === "string") {
        chatStore.addMessage(this.chatId, { role: "assistant", content });
        // Signal end of this assistant message
        this.broadcast({
          type: "assistant_message_end",
          content,
          chatId: this.chatId,
        });
      } else if (Array.isArray(content)) {
        const fullText: string[] = [];
        for (const block of content) {
          if (block.type === "text") {
            fullText.push(block.text);
          } else if (block.type === "tool_use") {
            this.broadcast({
              type: "tool_use",
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input,
              chatId: this.chatId,
            });
          }
        }
        if (fullText.length > 0) {
          chatStore.addMessage(this.chatId, {
            role: "assistant",
            content: fullText.join(""),
          });
          this.broadcast({
            type: "assistant_message_end",
            content: fullText.join(""),
            chatId: this.chatId,
          });
        }
      }
    } else if (message.type === "result") {
      this.broadcast({
        type: "result",
        success: message.subtype === "success",
        chatId: this.chatId,
        cost: message.total_cost_usd,
        duration: message.duration_ms,
      });
    }
  }

  subscribe(client: WSClient) {
    this.subscribers.add(client);
    client.sessionId = this.chatId;
  }

  unsubscribe(client: WSClient) {
    this.subscribers.delete(client);
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    for (const client of this.subscribers) {
      try {
        if (client.readyState === client.OPEN) {
          client.send(messageStr);
        }
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private broadcastError(error: string) {
    this.broadcast({ type: "error", error, chatId: this.chatId });
  }

  close() {
    this.agentSession.close();
  }
}
