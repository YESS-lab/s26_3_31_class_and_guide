import React, { useState, useRef, useEffect } from "react";
import { FileUpload } from "./FileUpload";
import { Waveform, SpectralBars } from "./Waveform";
import type { UITheme } from "../theme";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  streaming?: boolean;
}

interface ChatWindowProps {
  chatId: string | null;
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  welcomeMessage?: string;
  sessionId: string | null;
  onFileUploaded: (file: { originalName: string; storedPath: string }) => void;
  theme: UITheme;
}

function ToolUseBlock({
  message,
  theme,
}: {
  message: Message;
  theme: UITheme;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolSummary = () => {
    const input = message.toolInput || {};
    switch (message.toolName) {
      case "Read":
        return input.file_path;
      case "Write":
      case "Edit":
        return input.file_path;
      case "Bash":
        return input.command?.slice(0, 60) + (input.command?.length > 60 ? "..." : "");
      case "Grep":
        return `"${input.pattern}" in ${input.path || "."}`;
      case "Glob":
        return input.pattern;
      case "WebSearch":
        return input.query;
      case "WebFetch":
        return input.url;
      default:
        return JSON.stringify(input).slice(0, 50);
    }
  };

  if (theme === "translator") {
    return (
      <div className="mx-4 my-2 max-w-xl border border-[#26355c]/40 bg-[#141b2b] rounded-sm">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-[#1b2740]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7ea0f0]">
              {message.toolName}
            </span>
            <span className="font-mono text-[10px] text-[#5d6b8a] truncate">
              {getToolSummary()}
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#5d6b8a]">
            {isExpanded ? "▼" : "▶"}
          </span>
        </button>
        {isExpanded && (
          <div className="px-3 py-2 border-t border-[#26355c]/40">
            <pre className="font-mono text-[10px] text-[#9db4f0] overflow-x-auto">
              {JSON.stringify(message.toolInput, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="my-2 border border-gray-200 bg-gray-50 rounded">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-2 flex items-center justify-between text-left hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 uppercase">
            {message.toolName}
          </span>
          <span className="text-xs text-gray-500 truncate max-w-md">
            {getToolSummary()}
          </span>
        </div>
        <span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && (
        <div className="p-2 border-t border-gray-200">
          <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
            {JSON.stringify(message.toolInput, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        <p
          data-testid={isUser ? "user-message" : "assistant-message"}
          className="whitespace-pre-wrap"
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}

// ---- Translator theme (Project Hail Mary-inspired) ----

function sampleCode(index: number) {
  return `135-291-${String(259 + index).padStart(3, "0")}`;
}

// Decorative Eridian chord notation, deterministic per message
const NOTES = ["A", "B", "C", "D", "E", "F", "G", "A♯", "C♯", "D♯", "F♯", "G♯"];
function chords(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pick = () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return NOTES[h % NOTES.length];
  };
  const chord = () => `[${pick()},${pick()},${pick()}]`;
  return `${chord()} ${chord()}`;
}

function TranslationPanel({
  text,
  streaming,
  chordSeed,
  testId = "assistant-message",
}: {
  text: string;
  streaming?: boolean;
  chordSeed: string;
  testId?: string;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#0d2f8c] shadow-[0_2px_12px_rgba(20,50,140,0.35)]">
      <div className="flex items-center justify-between bg-[#0d2464] px-3 py-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#9db4f0]">
          Audio to text translation
        </span>
        <span className="font-mono text-[9px] text-[#5d77c4]">
          {chords(chordSeed)}
        </span>
      </div>
      <div className="bg-gradient-to-br from-[#1c46bc] to-[#2f63e0] px-4 py-4">
        <p
          data-testid={testId}
          className="whitespace-pre-wrap text-lg font-semibold tracking-wide text-white"
        >
          <span className="text-[#a9c0ff]">_</span>
          {text}
          {streaming && <span className="hm-cursor">▍</span>}
        </p>
      </div>
    </div>
  );
}

function TranslatorRow({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === "user";

  return (
    <div className="flex gap-3 border-b border-[#1e325a]/10 px-4 py-3">
      <div className="w-24 shrink-0 pt-1 font-mono text-[10px] leading-4 text-[#4a5b7c]">
        <div>{String(index + 1).padStart(3, "0")}</div>
        <div>{sampleCode(index)}</div>
        <div className="text-[9px] uppercase tracking-widest text-[#7c8aa5]">
          {isUser ? "human" : "eridian"}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {isUser ? (
          <div className="max-w-xl">
            <Waveform seed={message.content} variant="ink" className="h-8 w-full" />
            <p
              data-testid="user-message"
              className="mt-1 whitespace-pre-wrap font-mono text-sm text-[#16223f]"
            >
              {message.content}
            </p>
          </div>
        ) : (
          <div className="max-w-xl">
            <Waveform seed={message.content} variant="spectral" className="h-8 w-full" />
            <div className="mt-1">
              <TranslationPanel
                text={message.content}
                streaming={message.streaming}
                chordSeed={message.id}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({
  chatId,
  messages,
  isConnected,
  isLoading,
  onSendMessage,
  welcomeMessage,
  sessionId,
  onFileUploaded,
  theme,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isTranslator = theme === "translator";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatId || isLoading || !isConnected) return;
    onSendMessage(input.trim());
    setInput("");
  };

  if (!chatId) {
    if (isTranslator) {
      return (
        <div className="hm-grid flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg px-6">
            <TranslationPanel
              text={welcomeMessage || "Welcome. Select chat or create new one, question?"}
              chordSeed="welcome"
              testId="welcome-message"
            />
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[#5d6b8a]">
              No sample loaded — open new chat to begin
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 max-w-md px-4">
          <p className="text-lg">{welcomeMessage || "Welcome! Select a chat or create a new one to get started."}</p>
        </div>
      </div>
    );
  }

  if (isTranslator) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#e3e8f0]">
        {/* Status strip */}
        <div className="flex items-center justify-between border-b border-[#1e325a]/20 bg-[#eef1f6] px-4 py-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#5d6b8a]">
            Sample log — page 1
          </span>
          {isConnected ? (
            <span className="font-mono text-[10px] text-emerald-700">● link active</span>
          ) : (
            <span className="font-mono text-[10px] text-red-700">○ link lost</span>
          )}
        </div>

        {/* Column headers, spreadsheet style */}
        <div className="flex gap-3 border-b border-[#1e325a]/20 bg-[#d5dce8] px-4 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[#4a5b7c]">
          <div className="w-24 shrink-0">code</div>
          <div className="flex-1">waveform / translation</div>
        </div>

        {/* Sample rows */}
        <div className="hm-grid flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto mt-10 w-full max-w-lg px-6">
              <TranslationPanel
                text={welcomeMessage || "Start conversation, question?"}
                chordSeed="welcome"
                testId="welcome-message"
              />
            </div>
          ) : (
            <>
              {messages.map((msg, i) =>
                msg.role === "tool_use" ? (
                  <ToolUseBlock key={msg.id} message={msg} theme={theme} />
                ) : (
                  <TranslatorRow key={msg.id} message={msg} index={i} />
                )
              )}
              {isLoading && (
                <div className="flex items-center gap-3 px-4 py-3 pl-[7.75rem]">
                  <SpectralBars />
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#3d5aa8]">
                    Translating...
                  </span>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input console */}
        <div className="border-t border-[#0e1118] bg-[#14161d] p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <FileUpload
              sessionId={sessionId}
              onFileUploaded={onFileUploaded}
              theme={theme}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              disabled={!isConnected || isLoading}
              className="flex-1 rounded-sm border border-[#2a3040] bg-[#0d0f15] px-4 py-2 font-mono text-sm text-[#dfe5f2] placeholder-[#5d6b8a] focus:border-[#3f6fe0] focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || !isConnected || isLoading}
              className="rounded-sm bg-[#2f63e0] px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#3b71f0] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Translate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-h-0">
      {/* Connection status bar */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-end">
        {isConnected ? (
          <span className="text-xs text-green-600">● Connected</span>
        ) : (
          <span className="text-xs text-red-600">○ Disconnected</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <p>{welcomeMessage || "Start a conversation"}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) =>
              msg.role === "tool_use" ? (
                <ToolUseBlock key={msg.id} message={msg} theme={theme} />
              ) : (
                <MessageBubble key={msg.id} message={msg} />
              )
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <span className="animate-pulse">●</span>
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <FileUpload
            sessionId={sessionId}
            onFileUploaded={onFileUploaded}
            theme={theme}
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected || isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || !isConnected || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
