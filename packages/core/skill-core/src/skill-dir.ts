import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { parseSkillMarkdown } from "./frontmatter.js";
import type { SkillFrontmatter } from "@quickdeployai/skill-registry-schemas";

export interface LoadedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  skillDir: string;
  scripts: string[];
  references: string[];
  assets: string[];
}

/**
 * Load one skill directory: SKILL.md (required) plus optional scripts/,
 * references/, and assets/ file listings — the same directory shape
 * MCP-Registry's agent-skills-2-mcp importer consumes.
 */
export async function loadSkillDir(skillDir: string): Promise<LoadedSkill> {
  const content = await readFile(join(skillDir, "SKILL.md"), "utf8").catch(() => {
    throw new Error(`SKILL.md not found in ${skillDir}`);
  });
  const { frontmatter, body } = parseSkillMarkdown(content);

  return {
    frontmatter,
    body,
    skillDir,
    scripts: await listFiles(join(skillDir, "scripts")),
    references: await listFiles(join(skillDir, "references")),
    assets: await listFiles(join(skillDir, "assets")),
  };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1).split(sep).join("/"))
    .sort();
}
