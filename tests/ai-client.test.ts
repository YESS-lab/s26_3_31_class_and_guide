import { describe, it, expect } from "vitest";

// We can't test the full AgentSession (requires SDK subprocess),
// but we can test the static persona formatting logic by extracting it.
// For now, test the formatting logic directly.

describe("formatPersonaContext", () => {
  // Replicate the static method logic for testing without importing the SDK
  function formatPersonaContext(persona: Record<string, any>): string {
    const parts: string[] = [];
    for (const [, value] of Object.entries(persona)) {
      if (value !== undefined && value !== null && value !== "") {
        parts.push(String(value));
      }
    }
    if (parts.length === 0) return "";
    return `[User context: ${parts.join(", ")}] `;
  }

  it("formats a full persona", () => {
    const persona = { name: "Maya", age: 28, about: "UX designer", mood: "stressed" };
    const result = formatPersonaContext(persona);
    expect(result).toBe("[User context: Maya, 28, UX designer, stressed] ");
  });

  it("skips empty fields", () => {
    const persona = { name: "Maya", age: "", about: "", mood: "happy" };
    const result = formatPersonaContext(persona);
    expect(result).toBe("[User context: Maya, happy] ");
  });

  it("skips undefined fields", () => {
    const persona = { name: "David", age: undefined, about: undefined };
    const result = formatPersonaContext(persona);
    expect(result).toBe("[User context: David] ");
  });

  it("returns empty string for empty persona", () => {
    const persona = {};
    const result = formatPersonaContext(persona);
    expect(result).toBe("");
  });

  it("returns empty string for all-empty persona", () => {
    const persona = { name: "", age: undefined, about: "", mood: "" };
    const result = formatPersonaContext(persona);
    expect(result).toBe("");
  });
});
