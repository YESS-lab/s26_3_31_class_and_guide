import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for multi-turn session handling.
 *
 * The bug: V2 API's stream() yields messages for one turn then completes.
 * The old code called stream() once and never re-called it, so the second
 * message's response was silently dropped.
 *
 * These tests verify that sendAndStream() calls send() then stream() for
 * EACH message, and that Session.streamTurn() is invoked per message.
 */

// Mock the SDK — we can't spawn a real Claude subprocess in tests
const mockStream = vi.fn();
const mockSend = vi.fn();
const mockClose = vi.fn();

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  unstable_v2_createSession: vi.fn(() => ({
    sessionId: "test-session-id",
    send: mockSend,
    stream: mockStream,
    close: mockClose,
  })),
  unstable_v2_resumeSession: vi.fn(() => ({
    sessionId: "test-session-id",
    send: mockSend,
    stream: mockStream,
    close: mockClose,
  })),
}));

// Import after mock is set up
const { AgentSession } = await import("../server/ai-client.js");

describe("AgentSession.sendAndStream (multi-turn)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockStream(messages: any[]) {
    mockSend.mockResolvedValue(undefined);
    mockStream.mockReturnValue(
      (async function* () {
        for (const msg of messages) yield msg;
      })(),
    );
  }

  it("calls send() then stream() for each turn", async () => {
    const session = AgentSession.create();

    // Turn 1
    setupMockStream([{ type: "assistant", message: { content: "response 1" } }]);
    const msgs1: any[] = [];
    for await (const msg of session.sendAndStream("hello")) {
      msgs1.push(msg);
    }

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(msgs1).toHaveLength(1);

    // Turn 2 — this is where the old bug was: stream() was not called again
    setupMockStream([{ type: "assistant", message: { content: "response 2" } }]);
    const msgs2: any[] = [];
    for await (const msg of session.sendAndStream("follow up")) {
      msgs2.push(msg);
    }

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockStream).toHaveBeenCalledTimes(2);
    expect(msgs2).toHaveLength(1);
    expect(msgs2[0].message.content).toBe("response 2");
  });

  it("works for 5 consecutive turns", async () => {
    const session = AgentSession.create();

    for (let i = 1; i <= 5; i++) {
      setupMockStream([
        { type: "assistant", message: { content: `response ${i}` } },
      ]);
      const msgs: any[] = [];
      for await (const msg of session.sendAndStream(`message ${i}`)) {
        msgs.push(msg);
      }
      expect(msgs).toHaveLength(1);
      expect(msgs[0].message.content).toBe(`response ${i}`);
    }

    expect(mockSend).toHaveBeenCalledTimes(5);
    expect(mockStream).toHaveBeenCalledTimes(5);
  });

  it("prepends persona context to the sent message", async () => {
    const session = AgentSession.create();
    setupMockStream([]);

    const persona = { name: "Maya", age: 28, about: "UX designer" };
    // Consume the generator
    for await (const _ of session.sendAndStream("I want a new laptop", persona)) {}

    expect(mockSend).toHaveBeenCalledWith(
      "[User context: Maya, 28, UX designer] I want a new laptop",
    );
  });

  it("prepends file references to the sent message", async () => {
    const session = AgentSession.create();
    setupMockStream([]);

    for await (const _ of session.sendAndStream(
      "check this",
      undefined,
      ["/uploads/session1/notes.txt"],
    )) {}

    expect(mockSend).toHaveBeenCalledWith(
      "[Available files: /uploads/session1/notes.txt] check this",
    );
  });

  it("sends plain message when no persona or files", async () => {
    const session = AgentSession.create();
    setupMockStream([]);

    for await (const _ of session.sendAndStream("just a question")) {}

    expect(mockSend).toHaveBeenCalledWith("just a question");
  });

  it("skips persona prefix when all fields are empty", async () => {
    const session = AgentSession.create();
    setupMockStream([]);

    const emptyPersona = { name: "", age: undefined, about: "" };
    for await (const _ of session.sendAndStream("test", emptyPersona as any)) {}

    expect(mockSend).toHaveBeenCalledWith("test");
  });
});
