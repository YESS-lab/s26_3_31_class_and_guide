import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("agent-config.json", () => {
  const configPath = path.resolve("agent-config.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  it("has required top-level fields", () => {
    expect(config.name).toBeTruthy();
    expect(config.description).toBeTruthy();
    expect(config.welcome_message).toBeTruthy();
    expect(config.accent_color).toBeTruthy();
    expect(Array.isArray(config.persona_fields)).toBe(true);
  });

  it("accent_color is a valid hex color", () => {
    expect(config.accent_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("persona_fields have required shape", () => {
    for (const field of config.persona_fields) {
      expect(field.key).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(["text", "number", "textarea"]).toContain(field.type);
      expect(typeof field.required).toBe("boolean");
    }
  });

  it("has at least one persona field", () => {
    expect(config.persona_fields.length).toBeGreaterThan(0);
  });
});

describe("skills directory", () => {
  const skillsDir = path.resolve(".claude/skills");

  it("has a session-start skill", () => {
    const skillPath = path.join(skillsDir, "session-start", "SKILL.md");
    const content = readFileSync(skillPath, "utf-8");
    expect(content).toContain("name: session-start");
  });

  it("has at least 3 skills", () => {
    const { readdirSync, statSync } = require("fs");
    const entries = readdirSync(skillsDir).filter((e: string) => {
      return statSync(path.join(skillsDir, e)).isDirectory();
    });
    expect(entries.length).toBeGreaterThanOrEqual(3);
  });

  it("each skill has YAML frontmatter with name and description", () => {
    const { readdirSync, statSync } = require("fs");
    const entries = readdirSync(skillsDir).filter((e: string) => {
      return statSync(path.join(skillsDir, e)).isDirectory();
    });

    for (const entry of entries) {
      const skillFile = path.join(skillsDir, entry, "SKILL.md");
      const content = readFileSync(skillFile, "utf-8");
      expect(content).toMatch(/^---/);
      expect(content).toMatch(/name:\s*.+/);
      expect(content).toMatch(/description:\s*.+/);
    }
  });
});

describe("CLAUDE.md", () => {
  it("exists and references session-start skill", () => {
    const content = readFileSync(path.resolve("CLAUDE.md"), "utf-8");
    expect(content).toContain("session-start");
  });
});
