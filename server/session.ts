import type { WSClient, PersonaData } from "./types.js";
import { AgentSession } from "./ai-client.js";
import { chatStore } from "./chat-store.js";

// Session manages a single chat conversation with a long-lived agent
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
    this.agentSession = AgentSession.create();
  }

  /**
   * Store persona data for this session. Called when the client sends
   * persona information with a chat message.
   */
  setPersona(persona: PersonaData) {
    this.persona = persona;
  }

  /**
   * Register an uploaded file path so the agent knows it can Read it.
   */
  addUploadedFile(filePath: string) {
    if (!this.uploadedFiles.includes(filePath)) {
      this.uploadedFiles.push(filePath);
    }
  }

  // Start listening to agent output (call once)
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

  /**
   * Send a user message to the agent.
   *
   * If persona data is provided directly it takes precedence; otherwise
   * the stored persona (set via setPersona) is used.  Uploaded file
   * paths are always forwarded so the agent can reference them with Read.
   */
  sendMessage(content: string, persona?: PersonaData) {
    // Store user message
    chatStore.addMessage(this.chatId, {
      role: "user",
      content,
    });

    // Broadcast user message to subscribers
    this.broadcast({
      type: "user_message",
      content,
      chatId: this.chatId,
    });

    // Use provided persona or fall back to stored one
    const effectivePersona = persona || this.persona;

    // Send to agent with persona context and file references
    this.agentSession.sendMessage(
      content,
      effectivePersona,
      this.uploadedFiles.length > 0 ? this.uploadedFiles : undefined,
    );

    // Start listening if not already
    if (!this.isListening) {
      this.startListening();
    }
  }

  private handleSDKMessage(message: any) {
    if (message.type === "assistant") {
      const content = message.message.content;

      if (typeof content === "string") {
        chatStore.addMessage(this.chatId, {
          role: "assistant",
          content,
        });
        this.broadcast({
          type: "assistant_message",
          content,
          chatId: this.chatId,
        });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            chatStore.addMessage(this.chatId, {
              role: "assistant",
              content: block.text,
            });
            this.broadcast({
              type: "assistant_message",
              content: block.text,
              chatId: this.chatId,
            });
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
    this.broadcast({
      type: "error",
      error,
      chatId: this.chatId,
    });
  }

  // Close the session
  close() {
    this.agentSession.close();
  }
}
