import type { WebSocket } from "ws";

// WebSocket client with session data
export interface WSClient extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

// Chat stored in memory
export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// Message stored in memory
export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// --- Agent config & persona types ---

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

// --- WebSocket incoming messages ---

export interface WSChatMessage {
  type: "chat";
  content: string;
  chatId: string;
  persona?: PersonaData;
}

export interface WSSubscribeMessage {
  type: "subscribe";
  chatId: string;
}

export type IncomingWSMessage = WSChatMessage | WSSubscribeMessage;
