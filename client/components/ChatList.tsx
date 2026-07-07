import React from "react";
import { Waveform } from "./Waveform";
import type { UITheme } from "../theme";

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  agentName?: string;
  theme: UITheme;
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  agentName,
  theme,
}: ChatListProps) {
  const isTranslator = theme === "translator";

  if (isTranslator) {
    return (
      <div className="relative flex h-full flex-col bg-[#0d1119] pl-2 text-[#c8d3e8]" style={{ minHeight: 0 }}>
        {/* Rainbow spectrogram strip along the edge, like the tablet readout */}
        <div className="hm-spectral-strip absolute inset-y-0 left-0 w-1.5" />

        {/* Header */}
        <div className="border-b border-[#26355c]/50 p-4">
          <button
            onClick={onNewChat}
            className="w-full rounded-sm border border-[#2a3852] bg-[#141b2b] px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-[#9db4f0] transition-colors hover:bg-[#1b2740]"
          >
            + New Chat
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4 text-center text-[#5d6b8a]">
              <p className="font-mono text-xs uppercase tracking-[0.2em]">No samples yet</p>
              <p className="mt-1 font-mono text-[10px]">Click "New Chat" to record first sample</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 transition-colors ${
                    selectedChatId === chat.id
                      ? "bg-[#1b2740] ring-1 ring-[#3f6fe0]/50"
                      : "hover:bg-[#141b2b]"
                  }`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <Waveform seed={chat.title} variant="dim" bars={20} className="h-4 w-10 shrink-0" />
                  <span className="flex-1 truncate font-mono text-xs">{chat.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="rounded p-1 text-[#5d6b8a] opacity-0 transition-all hover:bg-[#26355c] hover:text-white group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#26355c]/50 p-4">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[#5d6b8a]">
            {agentName || "Chat App"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <span>+</span>
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">No chats yet</p>
            <p className="text-xs mt-1">Click "New Chat" to start</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedChatId === chat.id
                    ? "bg-gray-700"
                    : "hover:bg-gray-800"
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <span className="text-gray-400 shrink-0">💬</span>
                <span className="flex-1 truncate text-sm">{chat.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          {agentName || "Chat App"}
        </p>
      </div>
    </div>
  );
}
