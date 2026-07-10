import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

export const SkillFrontmatterSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    license: z.string().min(1).optional(),
    compatibility: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    "allowed-tools": z.string().min(1).optional(),
  })
  .catchall(z.unknown());

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface ParsedSkillMarkdown {
  frontmatter: SkillFrontmatter;
  body: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const match = FRONTMATTER_PATTERN.exec(content);
  if (!match) {
    throw new Error("SKILL.md must start with closed YAML frontmatter");
  }

  const frontmatter = SkillFrontmatterSchema.parse(parseYaml(match[1] ?? ""));
  const body = (match[2] ?? "").trim();
  if (!body) {
    throw new Error("SKILL.md body must not be empty");
  }

  return { frontmatter, body };
}

export function renderSkillMarkdown(frontmatter: SkillFrontmatter, body: string): string {
  const parsed = SkillFrontmatterSchema.parse(frontmatter);
  return `---\n${stringifyYaml(parsed, { lineWidth: 0 }).trimEnd()}\n---\n\n${body.trim()}\n`;
}
