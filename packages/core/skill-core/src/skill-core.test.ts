import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillManifest } from "@quickdeployai/skill-registry-schemas";
import { parseSkillMarkdown, serializeSkillMarkdown } from "./frontmatter.js";
import { computeSkillContentHash, sha256Hex } from "./hash.js";
import { loadSkillDir } from "./skill-dir.js";
import { fetchBytesSource } from "./source-fetcher.js";
import { validateSkillAgainstManifest } from "./validate.js";

const SKILL_MD = `---
name: example-skill
description: An example skill used by skill-core tests.
metadata:
  "ai.quickdeploy.skills/read-only": "true"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
---

# Example skill

Body content.
`;

function exampleManifest(): SkillManifest {
  return {
    apiVersion: "quickdeploy.ai/v1",
    kind: "SkillManifest",
    metadata: {
      name: "ai.quickdeploy/example-skill",
      version: "0.1.0",
      labels: [],
    },
    spec: {
      source: { type: "file", uri: "skills/quickdeploy/example-skill" },
      skill: {
        name: "example-skill",
        description: "An example skill used by skill-core tests.",
        metadata: {
          "ai.quickdeploy.skills/read-only": "true",
          "ai.quickdeploy.skills/sandbox-default": "sandbox",
        },
      },
      safety: {
        readOnly: true,
        destructiveOperations: [],
        sandbox: { supported: true, defaultMode: "sandbox" },
        secretsPolicy: "env-names-only",
      },
      references: [{ path: "references/usage.md" }],
      scripts: [],
      output: { path: "skills/quickdeploy/example-skill" },
    },
  };
}

async function writeExampleSkill(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skill-core-test-"));
  await writeFile(join(dir, "SKILL.md"), SKILL_MD, "utf8");
  await mkdir(join(dir, "references"), { recursive: true });
  await writeFile(join(dir, "references", "usage.md"), "# Usage\n", "utf8");
  return dir;
}

describe("frontmatter", () => {
  it("round-trips SKILL.md through parse and serialize", () => {
    const parsed = parseSkillMarkdown(SKILL_MD);
    expect(parsed.frontmatter.name).toBe("example-skill");
    expect(parsed.body).toContain("# Example skill");

    const reparsed = parseSkillMarkdown(serializeSkillMarkdown(parsed));
    expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
    expect(reparsed.body).toBe(parsed.body);
  });

  it("rejects SKILL.md without frontmatter or required fields", () => {
    expect(() => parseSkillMarkdown("# No frontmatter\n")).toThrow(/frontmatter/);
    expect(() => parseSkillMarkdown("---\nname: only-name\n---\nbody")).toThrow();
  });
});

describe("loadSkillDir + validate", () => {
  it("loads a skill directory and validates cleanly against its manifest", async () => {
    const dir = await writeExampleSkill();
    const skill = await loadSkillDir(dir);
    expect(skill.references).toEqual(["usage.md"]);
    expect(validateSkillAgainstManifest(skill, exampleManifest())).toEqual([]);
  });

  it("collects violations for safety-mirror drift, missing references, and undeclared scripts", async () => {
    const dir = await writeExampleSkill();
    await mkdir(join(dir, "scripts"), { recursive: true });
    await writeFile(join(dir, "scripts", "sneaky.sh"), "#!/bin/sh\n", "utf8");

    const manifest = exampleManifest();
    manifest.spec.safety.readOnly = false;
    manifest.spec.safety.destructiveOperations = [
      { name: "delete-things", description: "Deletes things.", confirmation: "explicit" },
    ];
    manifest.spec.references.push({ path: "references/missing.md" });

    const skill = await loadSkillDir(dir);
    const codes = validateSkillAgainstManifest(skill, manifest)
      .map((violation) => violation.code)
      .sort();
    expect(codes).toEqual([
      "missing-referenced-file",
      "safety-mirror-mismatch",
      "safety-mirror-mismatch",
      "undeclared-script",
    ]);
  });
});

describe("hash + source-fetcher", () => {
  it("computes the skills-lock-compatible content hash over SKILL.md bytes", async () => {
    const dir = await writeExampleSkill();
    expect(await computeSkillContentHash(dir)).toBe(sha256Hex(SKILL_MD));
  });

  it("verifies digests when fetching sources", async () => {
    const dir = await writeExampleSkill();
    const path = join(dir, "SKILL.md");
    const digest = `sha256:${sha256Hex(SKILL_MD)}`;

    await expect(fetchBytesSource(path, { digest })).resolves.toBeInstanceOf(Uint8Array);
    await expect(
      fetchBytesSource(path, { digest: `sha256:${"0".repeat(64)}` }),
    ).rejects.toThrow(/Digest mismatch/);
  });
});
