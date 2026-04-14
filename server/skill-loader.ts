import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";

// --- Types ---

export interface SkillMeta {
  name: string;
  description: string;
  content: string;
}

// --- Frontmatter parsing ---

/**
 * Reads a SKILL.md file, parses its YAML frontmatter, and returns
 * the skill name, description, and markdown content body.
 */
export function parseSkillFile(filePath: string): SkillMeta {
  const raw = readFileSync(filePath, "utf-8");

  // Frontmatter is delimited by "---" on its own line at the start of the file
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = raw.match(fmRegex);

  if (!match) {
    // No frontmatter — use the directory name as the skill name
    const dirName = basename(join(filePath, ".."));
    return {
      name: dirName,
      description: "",
      content: raw.trim(),
    };
  }

  const frontmatter = match[1];
  const content = match[2].trim();

  // Simple YAML key: value parser (handles single-line string values only,
  // which is all the skill frontmatter uses)
  const yamlLines = frontmatter.split(/\r?\n/);
  const meta: Record<string, string> = {};
  for (const line of yamlLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    meta[key] = value;
  }

  return {
    name: meta["name"] || basename(join(filePath, "..")),
    description: meta["description"] || "",
    content,
  };
}

// --- Skill discovery ---

/**
 * Reads all subdirectories of `skillsDir`, looking for a SKILL.md in each.
 * Returns an array of parsed skill metadata.
 */
export function loadSkills(skillsDir: string): SkillMeta[] {
  const entries = readdirSync(skillsDir);
  const skills: SkillMeta[] = [];

  for (const entry of entries) {
    const entryPath = join(skillsDir, entry);

    // Only look at directories
    if (!statSync(entryPath).isDirectory()) continue;

    const skillFile = join(entryPath, "SKILL.md");
    try {
      statSync(skillFile); // throws if not found
    } catch {
      continue; // no SKILL.md in this directory — skip
    }

    skills.push(parseSkillFile(skillFile));
  }

  return skills;
}

// --- System prompt composition ---

/**
 * Composes all loaded skills into a single system prompt string.
 *
 * - The `session-start` skill is placed first because it defines the agent
 *   personality and intent-routing logic.
 * - All other skills follow as clearly delineated sections.
 * - A preamble explains the `/skill-name` transition convention.
 */
export function buildSystemPrompt(skills: SkillMeta[]): string {
  const sessionStart = skills.find((s) => s.name === "session-start");
  const otherSkills = skills.filter((s) => s.name !== "session-start");

  // Sort remaining skills alphabetically for deterministic ordering
  otherSkills.sort((a, b) => a.name.localeCompare(b.name));

  const sections: string[] = [];

  // --- Session-start (core personality + routing) ---
  if (sessionStart) {
    sections.push(sessionStart.content);
  }

  // --- Transition convention note ---
  sections.push(
    [
      "---",
      "",
      "## Skill Transition Convention",
      "",
      "When instructions say \"transition to `/skill-name`\", it means: stop following the current skill's instructions and begin following the section below whose heading matches that skill name. Treat each skill section as a self-contained set of instructions you adopt when transitioning.",
      "",
      "The following skills are available:",
      "",
      ...otherSkills.map((s) => `- \`/${s.name}\` — ${s.description}`),
      "",
      "---",
    ].join("\n"),
  );

  // --- Individual skill sections ---
  for (const skill of otherSkills) {
    sections.push(
      [
        `<!-- SKILL: /${skill.name} -->`,
        "",
        skill.content,
        "",
        `<!-- END SKILL: /${skill.name} -->`,
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}
