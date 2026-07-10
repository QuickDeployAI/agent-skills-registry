import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * SHA-256 (hex) of a skill's SKILL.md bytes — the file `skillPath` points at.
 * This matches the monorepo skills-lock.json `computedHash` semantics so
 * consumer-side pins and registry entries agree on the same value.
 */
export async function computeSkillContentHash(skillDir: string): Promise<string> {
  const bytes = await readFile(join(skillDir, "SKILL.md"));
  return sha256Hex(bytes);
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
