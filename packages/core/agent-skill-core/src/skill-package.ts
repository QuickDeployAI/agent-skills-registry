import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { assertSafeRelativePath, toPosixPath } from "./paths";
import { parseSkillMarkdown, type SkillFrontmatter } from "./skill-markdown";

export interface LoadedSkillPackage {
  rootDir: string;
  entrypoint: string;
  frontmatter: SkillFrontmatter;
  body: string;
  artifacts: {
    scripts: string[];
    references: string[];
    assets: string[];
  };
}

async function listFiles(rootDir: string, subdir: string): Promise<string[]> {
  const target = path.join(rootDir, subdir);
  try {
    const targetStat = await stat(target);
    if (!targetStat.isDirectory()) return [];
  } catch {
    return [];
  }

  const files: string[] = [];
  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push(toPosixPath(path.relative(target, fullPath)));
    }
  }

  await visit(target);
  return files.sort((left, right) => left.localeCompare(right));
}

export async function loadSkillPackage(
  rootDir: string,
  entrypoint = "SKILL.md",
): Promise<LoadedSkillPackage> {
  assertSafeRelativePath(entrypoint);
  const skillMarkdown = await readFile(path.join(rootDir, entrypoint), "utf8");
  const parsed = parseSkillMarkdown(skillMarkdown);

  return {
    rootDir,
    entrypoint,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    artifacts: {
      scripts: await listFiles(rootDir, "scripts"),
      references: await listFiles(rootDir, "references"),
      assets: await listFiles(rootDir, "assets"),
    },
  };
}
