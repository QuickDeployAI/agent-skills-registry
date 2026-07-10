import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRegistryEntries } from "../src/registry-validate.js";
import { exampleManifest, writeExampleRegistry, writeJson, writeText } from "./helpers.js";

describe("validateRegistryEntries", () => {
  it("passes a well-formed registry", async () => {
    const rootDir = await writeExampleRegistry();
    const result = await validateRegistryEntries({ rootDir });
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBe(1);
  });

  it("collects all violations instead of failing fast", async () => {
    const rootDir = await writeExampleRegistry();

    // Duplicate registry name + missing skill directory.
    const duplicate = exampleManifest();
    duplicate.spec.output.path = "skills/quickdeploy/missing-skill";
    duplicate.spec.source.uri = "skills/quickdeploy/missing-skill";
    await writeJson(join(rootDir, "registry/quickdeploy/duplicate.skill.json"), duplicate);

    // Malformed manifest (version range).
    const badVersion = exampleManifest();
    badVersion.metadata.version = "^1.0.0" as never;
    await writeJson(join(rootDir, "registry/quickdeploy/bad-version.skill.json"), badVersion);

    const result = await validateRegistryEntries({ rootDir });
    const codes = result.violations.map((violation) => violation.code).sort();
    expect(result.ok).toBe(false);
    expect(codes).toEqual([
      "duplicate-name",
      "duplicate-name",
      "invalid-source",
      "missing-skill-directory",
    ]);
  });

  it("rejects skill directories that drift from their manifest", async () => {
    const rootDir = await writeExampleRegistry();
    await writeText(
      join(rootDir, "skills/quickdeploy/example-skill/scripts/undeclared.sh"),
      "#!/bin/sh\n",
    );

    const result = await validateRegistryEntries({ rootDir });
    expect(result.violations.map((violation) => violation.code)).toContain(
      "skill-content-mismatch",
    );
  });

  it("rejects skillsets claiming the ai.quickdeploy namespace and misplaced sources", async () => {
    const rootDir = await writeExampleRegistry();
    await writeJson(join(rootDir, "registry/external/pinned.skillset.json"), {
      apiVersion: "quickdeploy.ai/v1",
      kind: "SkillSet",
      metadata: { name: "ai.quickdeploy/not-allowed", version: "0.1.0", labels: [] },
      spec: {
        skills: [
          {
            name: "external-skill",
            source: "example/repo",
            sourceType: "github",
            skillPath: "skills/external-skill/SKILL.md",
            computedHash: "a".repeat(64),
          },
        ],
      },
    });
    await writeJson(join(rootDir, "registry/stray.skill.json"), exampleManifest());

    const result = await validateRegistryEntries({ rootDir });
    const codes = result.violations.map((violation) => violation.code);
    expect(codes).toContain("name-namespace-mismatch");
    expect(codes).toContain("invalid-source");
  });
});
