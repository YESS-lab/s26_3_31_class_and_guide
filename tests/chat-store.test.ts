import { describe, it, expect, beforeEach } from "vitest";
import { chatStore } from "../server/chat-store.js";

// chatStore is a singleton, so we test it directly.
// Note: tests share state. We work around this by using unique titles.

describe("ChatStore", () => {
  it("creates a chat with default title", () => {
    const chat = chatStore.createChat();
    expect(chat.id).toBeTruthy();
    expect(chat.title).toBe("New Chat");
    expect(chat.createdAt).toBeTruthy();
    expect(chat.updatedAt).toBeTruthy();
  });

  it("creates a chat with custom title", () => {
    const chat = chatStore.createChat("Test Chat");
    expect(chat.title).toBe("Test Chat");
  });

  it("retrieves a chat by ID", () => {
    const created = chatStore.createChat("Retrieve Test");
    const found = chatStore.getChat(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.title).toBe("Retrieve Test");
  });

  it("returns undefined for nonexistent chat", () => {
    const found = chatStore.getChat("nonexistent-id");
    expect(found).toBeUndefined();
  });

  it("lists all chats sorted by updatedAt descending", () => {
    const a = chatStore.createChat("Sort A");
    // Add a message to 'a' so its updatedAt is later than 'b'
    const b = chatStore.createChat("Sort B");
    chatStore.addMessage(a.id, { role: "user", content: "bump" });
    const all = chatStore.getAllChats();
    // 'a' was updated most recently, so it should come first
    const idxA = all.findIndex((c) => c.id === a.id);
    const idxB = all.findIndex((c) => c.id === b.id);
    expect(idxA).toBeLessThan(idxB);
  });

  it("deletes a chat", () => {
    const chat = chatStore.createChat("Delete Me");
    expect(chatStore.deleteChat(chat.id)).toBe(true);
    expect(chatStore.getChat(chat.id)).toBeUndefined();
  });

  it("returns false when deleting nonexistent chat", () => {
    expect(chatStore.deleteChat("no-such-id")).toBe(false);
  });

  it("adds and retrieves messages", () => {
    const chat = chatStore.createChat("Messages Test");
    const msg = chatStore.addMessage(chat.id, {
      role: "user",
      content: "Hello there",
    });
    expect(msg.id).toBeTruthy();
    expect(msg.chatId).toBe(chat.id);
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello there");

    const messages = chatStore.getMessages(chat.id);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[messages.length - 1].content).toBe("Hello there");
  });

  it("auto-titles chat from first user message", () => {
    const chat = chatStore.createChat();
    expect(chat.title).toBe("New Chat");

    chatStore.addMessage(chat.id, {
      role: "user",
      content: "I want to buy a new laptop",
    });

    const updated = chatStore.getChat(chat.id);
    expect(updated!.title).toBe("I want to buy a new laptop");
  });

  it("truncates long auto-titles to 50 chars", () => {
    const chat = chatStore.createChat();
    const longMessage = "A".repeat(100);
    chatStore.addMessage(chat.id, { role: "user", content: longMessage });

    const updated = chatStore.getChat(chat.id);
    expect(updated!.title.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(updated!.title).toContain("...");
  });

  it("returns empty array for messages of nonexistent chat", () => {
    expect(chatStore.getMessages("no-such-chat")).toEqual([]);
  });
});
