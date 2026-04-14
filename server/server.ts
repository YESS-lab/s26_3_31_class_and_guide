import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { WSClient, IncomingWSMessage, AgentConfig, UploadedFile } from "./types.js";
import { chatStore } from "./chat-store.js";
import { Session } from "./session.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

// --- Load agent config ---
const agentConfigPath = path.join(__dirname, "../agent-config.json");
const agentConfig: AgentConfig = JSON.parse(
  fs.readFileSync(agentConfigPath, "utf-8"),
);
console.log(`[server] Agent: ${agentConfig.name}`);

// --- Ensure uploads directory exists ---
const UPLOADS_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from client directory (dev mode)
app.use("/client", express.static(path.join(__dirname, "../client")));

// Serve built frontend from dist/ (production mode, after vite build)
const distDir = path.join(__dirname, "../dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// Serve index.html at root
app.get("/", (req, res) => {
  // Prefer built dist/ if it exists, otherwise fall back to client/
  const distIndex = path.join(distDir, "index.html");
  const clientIndex = path.join(__dirname, "../client/index.html");
  if (fs.existsSync(distIndex)) {
    res.sendFile(distIndex);
  } else {
    res.sendFile(clientIndex);
  }
});

// --- Agent config endpoint ---
app.get("/api/config", (_req, res) => {
  res.json(agentConfig);
});

// --- File upload endpoint ---
app.post(
  "/api/upload/:sessionId",
  express.raw({ type: "*/*", limit: "10mb" }),
  (req, res) => {
    try {
      const { sessionId } = req.params;
      const originalName = (req.headers["x-filename"] as string) || "upload";

      // Sanitize filename: keep only alphanumeric, dash, underscore, dot
      const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");

      // Create session-specific upload directory
      const sessionDir = path.join(UPLOADS_DIR, sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const storedPath = path.join(sessionDir, sanitized);
      fs.writeFileSync(storedPath, req.body);

      const uploadedFile: UploadedFile = {
        originalName,
        storedPath,
        uploadedAt: new Date().toISOString(),
      };

      // Register the file with the session so the agent can reference it
      const session = sessions.get(sessionId);
      if (session) {
        session.addUploadedFile(storedPath);
      }

      console.log(`[upload] ${originalName} -> ${storedPath}`);
      res.json(uploadedFile);
    } catch (error) {
      console.error("[upload] Error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

// --- List uploaded files for a session ---
app.get("/api/uploads/:sessionId", (req, res) => {
  const sessionDir = path.join(UPLOADS_DIR, req.params.sessionId);
  if (!fs.existsSync(sessionDir)) {
    return res.json([]);
  }
  const files = fs.readdirSync(sessionDir).map((name) => ({
    originalName: name,
    storedPath: path.join(sessionDir, name),
  }));
  res.json(files);
});

// Session management
const sessions: Map<string, Session> = new Map();

function getOrCreateSession(chatId: string): Session {
  let session = sessions.get(chatId);
  if (!session) {
    session = new Session(chatId);
    sessions.set(chatId, session);
  }
  return session;
}

// REST API: Get all chats
app.get("/api/chats", (req, res) => {
  const chats = chatStore.getAllChats();
  res.json(chats);
});

// REST API: Create new chat
app.post("/api/chats", (req, res) => {
  const chat = chatStore.createChat(req.body?.title);
  res.status(201).json(chat);
});

// REST API: Get single chat
app.get("/api/chats/:id", (req, res) => {
  const chat = chatStore.getChat(req.params.id);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.json(chat);
});

// REST API: Delete chat
app.delete("/api/chats/:id", (req, res) => {
  const deleted = chatStore.deleteChat(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Chat not found" });
  }
  const session = sessions.get(req.params.id);
  if (session) {
    session.close();
    sessions.delete(req.params.id);
  }
  res.json({ success: true });
});

// REST API: Get chat messages
app.get("/api/chats/:id/messages", (req, res) => {
  const messages = chatStore.getMessages(req.params.id);
  res.json(messages);
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WSClient) => {
  console.log("WebSocket client connected");
  ws.isAlive = true;

  ws.send(JSON.stringify({ type: "connected", message: "Connected to chat server" }));

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    try {
      const message: IncomingWSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case "subscribe": {
          const session = getOrCreateSession(message.chatId);
          session.subscribe(ws);
          console.log(`Client subscribed to chat ${message.chatId}`);

          // Send existing messages
          const messages = chatStore.getMessages(message.chatId);
          ws.send(JSON.stringify({
            type: "history",
            messages,
            chatId: message.chatId,
          }));
          break;
        }

        case "chat": {
          const session = getOrCreateSession(message.chatId);
          session.subscribe(ws);

          // Pass persona data if provided in the message
          if (message.persona) {
            session.setPersona(message.persona);
          }

          session.sendMessage(message.content, message.persona);
          break;
        }

        default:
          console.warn("Unknown message type:", (message as any).type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    // Unsubscribe from all sessions
    for (const session of sessions.values()) {
      session.unsubscribe(ws);
    }
  });
});

// Heartbeat to detect dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = ws as WSClient;
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeat);
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint available at ws://localhost:${PORT}/ws`);
  console.log(`Visit http://localhost:${PORT} to view the chat interface`);
});
