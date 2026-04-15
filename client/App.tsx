import { useState, useEffect, useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { ChatList } from "./components/ChatList";
import { ChatWindow } from "./components/ChatWindow";
import { PersonaEditor } from "./components/PersonaEditor";

interface PersonaField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  required: boolean;
  placeholder?: string;
}

interface AgentConfig {
  name: string;
  description: string;
  welcome_message: string;
  accent_color: string;
  persona_fields: PersonaField[];
}

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  streaming?: boolean;
}

// Use relative URLs - Vite will proxy to the backend
const API_BASE = "/api";
const WS_URL = `ws://${window.location.hostname}:3001/ws`;

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [persona, setPersona] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // Handle WebSocket messages
  const handleWSMessage = useCallback((message: any) => {
    switch (message.type) {
      case "connected":
        console.log("Connected to server");
        break;

      case "history":
        setMessages(message.messages || []);
        break;

      case "user_message":
        // User message already added locally
        break;

      case "assistant_delta":
        // Streaming text delta — append to the last assistant message
        // or create a new one if there isn't one being streamed
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.streaming) {
            // Append to existing streaming message
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + message.content },
            ];
          }
          // Start a new streaming message
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content: message.content,
              timestamp: new Date().toISOString(),
              streaming: true,
            },
          ];
        });
        break;

      case "assistant_message_end":
        // Complete message received — finalize the streaming message
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.streaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, streaming: false },
            ];
          }
          // Fallback: add as a complete message
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content: message.content,
              timestamp: new Date().toISOString(),
            },
          ];
        });
        setIsLoading(false);
        break;

      case "assistant_message":
        // Legacy: complete message without streaming (e.g. from history)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: message.content,
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        break;

      case "tool_use":
        // Add tool use to messages array so it persists
        // Alternative: To show tool uses only while pending, store them in a
        // separate `pendingToolUses` state and clear it on "assistant_message" or "result"
        setMessages((prev) => [
          ...prev,
          {
            id: message.toolId,
            role: "tool_use",
            content: "",
            timestamp: new Date().toISOString(),
            toolName: message.toolName,
            toolInput: message.toolInput,
          },
        ]);
        break;

      case "result":
        setIsLoading(false);
        // Refresh chat list to get updated titles
        fetchChats();
        break;

      case "error":
        console.error("Server error:", message.error);
        setIsLoading(false);
        break;
    }
  }, []);

  const { sendJsonMessage, readyState, lastJsonMessage } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  const isConnected = readyState === ReadyState.OPEN;

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastJsonMessage) {
      handleWSMessage(lastJsonMessage);
    }
  }, [lastJsonMessage, handleWSMessage]);

  // Fetch all chats
  const fetchChats = async () => {
    try {
      const res = await fetch(`${API_BASE}/chats`);
      const data = await res.json();
      setChats(data);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    }
  };

  // Create new chat
  const createChat = async () => {
    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const chat = await res.json();
      setChats((prev) => [chat, ...prev]);
      selectChat(chat.id);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  // Delete chat
  const deleteChat = async (chatId: string) => {
    try {
      await fetch(`${API_BASE}/chats/${chatId}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChatId === chatId) {
        setSelectedChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  // Select a chat
  const selectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setMessages([]);
    setIsLoading(false);

    // Subscribe to chat via WebSocket
    sendJsonMessage({ type: "subscribe", chatId });
  };

  // Send a message
  const handleSendMessage = (content: string) => {
    if (!selectedChatId || !isConnected) return;

    // Add message optimistically
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      },
    ]);

    setIsLoading(true);

    // Send via WebSocket (include persona data)
    sendJsonMessage({
      type: "chat",
      content,
      chatId: selectedChatId,
      persona,
    });
  };

  // Initial fetch
  useEffect(() => {
    fetchChats();

    // Fetch agent config
    fetch(`${API_BASE}/config`)
      .then((res) => res.json())
      .then((data: AgentConfig) => {
        setConfig(data);
        document.title = data.name;
        // Set CSS custom property for accent color
        document.documentElement.style.setProperty(
          "--accent-color",
          data.accent_color
        );
      })
      .catch((err) => console.error("Failed to fetch config:", err));
  }, []);

  // Handle file uploads
  const handleFileUploaded = (file: {
    originalName: string;
    storedPath: string;
  }) => {
    setUploadedFiles((prev) => [...prev, file.storedPath]);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col bg-gray-900">
        <div className="flex-1 overflow-y-auto">
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onSelectChat={selectChat}
            onNewChat={createChat}
            onDeleteChat={deleteChat}
            agentName={config?.name}
          />
        </div>
        {config && config.persona_fields.length > 0 && (
          <PersonaEditor
            fields={config.persona_fields}
            persona={persona}
            onPersonaChange={setPersona}
            accentColor={config.accent_color}
          />
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Branding header */}
        {config && (
          <div
            className="px-6 py-3 border-b border-gray-200"
            style={{ borderBottomColor: config.accent_color + "40" }}
          >
            <h1
              className="text-lg font-semibold"
              style={{ color: config.accent_color }}
            >
              {config.name}
            </h1>
            <p className="text-sm text-gray-500">{config.description}</p>
          </div>
        )}
        <ChatWindow
          chatId={selectedChatId}
          messages={messages}
          isConnected={isConnected}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          welcomeMessage={config?.welcome_message}
          sessionId={selectedChatId}
          onFileUploaded={handleFileUploaded}
        />
      </div>
    </div>
  );
}
