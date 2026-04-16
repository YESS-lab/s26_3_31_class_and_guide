import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the AgentSession wrapper around the SDK query() API.
 *
 * Verifies:
 * - query() is called with settingSources: ['project'] to load skills
 * - Correct model, permissionMode, maxTurns
 * - Persona context prepended to messages
 * - File references prepended to messages
 * - Multiple messages flow through the queue
 */

let capturedQueryParams: any = null;
let queueRef: any = null;

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn((params: any) => {
    capturedQueryParams = params;
    // Save the MessageQueue reference so tests can read what was pushed
    queueRef = params.prompt;

    // Return a minimal async generator that never yields
    // (we don't need to test the output stream here, just the input)
    return (async function* () {
      // Keep the generator alive so the session doesn't terminate
      await new Promise(() => {});
    })();
  }),
}));

const { AgentSession } = await import("../server/ai-client.js");

describe("AgentSession query() configuration", () => {
  beforeEach(() => {
    capturedQueryParams = null;
    queueRef = null;
  });

  it("calls query() with settingSources: ['project'] to load skills and CLAUDE.md", () => {
    new AgentSession();
    expect(capturedQueryParams).toBeTruthy();
    expect(capturedQueryParams.options.settingSources).toEqual(["project"]);
  });

  it("uses sonnet model", () => {
    new AgentSession();
    expect(capturedQueryParams.options.model).toBe("sonnet");
  });

  it("uses bypassPermissions mode for deployed agent", () => {
    new AgentSession();
    expect(capturedQueryParams.options.permissionMode).toBe("bypassPermissions");
    expect(capturedQueryParams.options.allowDangerouslySkipPermissions).toBe(true);
  });

  it("sets maxTurns to limit runaway conversations", () => {
    new AgentSession();
    expect(capturedQueryParams.options.maxTurns).toBe(50);
  });

  it("passes a MessageQueue as the prompt (async iterable)", () => {
    new AgentSession();
    expect(capturedQueryParams.prompt).toBeTruthy();
    expect(typeof capturedQueryParams.prompt[Symbol.asyncIterator]).toBe("function");
  });
});

describe("AgentSession.sendMessage (message queue injection)", () => {
  // We test sendMessage by verifying the MessageQueue contents.
  // The queue is an async iterable — we read from it to verify messages.

  async function readNextMessage(queue: any, timeoutMs = 200): Promise<string | null> {
    const iterator = queue[Symbol.asyncIterator]();
    const result = await Promise.race([
      iterator.next(),
      new Promise<{ done: true }>((r) => setTimeout(() => r({ done: true } as any), timeoutMs)),
    ]);
    if (result.done) return null;
    return (result as any).value.message.content;
  }

  it("pushes plain message to queue", async () => {
    const session = new AgentSession();
    session.sendMessage("hello");
    const msg = await readNextMessage(queueRef);
    expect(msg).toBe("hello");
  });

  it("prepends persona context", async () => {
    const session = new AgentSession();
    session.sendMessage("I want a laptop", { name: "Maya", age: 28 });
    const msg = await readNextMessage(queueRef);
    expect(msg).toBe("[User context: Maya, 28] I want a laptop");
  });

  it("prepends file references", async () => {
    const session = new AgentSession();
    session.sendMessage("check this", undefined, ["/uploads/s1/notes.txt"]);
    const msg = await readNextMessage(queueRef);
    expect(msg).toBe("[Available files: /uploads/s1/notes.txt] check this");
  });

  it("prepends both persona and files", async () => {
    const session = new AgentSession();
    session.sendMessage("help me", { name: "David" }, ["/uploads/s1/data.json"]);
    const msg = await readNextMessage(queueRef);
    expect(msg).toBe(
      "[User context: David] [Available files: /uploads/s1/data.json] help me",
    );
  });

  it("skips persona prefix when all fields empty", async () => {
    const session = new AgentSession();
    session.sendMessage("test", { name: "", age: undefined } as any);
    const msg = await readNextMessage(queueRef);
    expect(msg).toBe("test");
  });
});

describe("AgentSession.formatPersonaContext (static)", () => {
  it("formats full persona", () => {
    expect(
      AgentSession.formatPersonaContext({ name: "Maya", age: 28, about: "UX designer" }),
    ).toBe("[User context: Maya, 28, UX designer] ");
  });

  it("returns empty string for empty persona", () => {
    expect(AgentSession.formatPersonaContext({})).toBe("");
  });

  it("returns empty string for all-empty values", () => {
    expect(
      AgentSession.formatPersonaContext({ name: "", age: undefined }),
    ).toBe("");
  });
});
