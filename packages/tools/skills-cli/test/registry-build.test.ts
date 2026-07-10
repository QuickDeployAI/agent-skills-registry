import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@quickdeployai/skill-core";
import { SkillsJsonEnvelopeSchema } from "@quickdeployai/skill-registry-schemas";
import {
  buildRegistryArtifacts,
  checkGeneratedRegistryArtifacts,
  writeRegistryArtifacts,
} from "../src/registry-build.js";
import { EXAMPLE_SKILL_MD, writeExampleRegistry, writeJson } from "./helpers.js";

describe("buildRegistryArtifacts", () => {
  it("compiles manifests into a schema-valid skills.json with the agents compat index", async () => {
    const rootDir = await writeExampleRegistry();
    const artifacts = await buildRegistryArtifacts({ rootDir });

    const envelope = SkillsJsonEnvelopeSchema.parse(artifacts.skillsJson);
    expect(envelope.agents).toEqual([
      {
        skill: "skills/quickdeploy/example-skill/SKILL.md",
        summary: "An example skill used by skills-cli tests.",
      },
    ]);

    const entry = envelope.skills[0];
    expect(entry?.name).toBe("ai.quickdeploy/example-skill");
    expect(entry?.skillPath).toBe("skills/quickdeploy/example-skill");
    expect(entry?.contentHash).toBe(sha256Hex(EXAMPLE_SKILL_MD));
    expect(entry?._meta?.["ai.quickdeploy.registry/curation"]).toMatchObject({
      verifiedStatus: "review",
      category: "authored",
      isOfficial: true,
      tags: ["authored", "example", "smb"],
    });
    expect(entry?._meta?.["ai.quickdeploy.registry/safety"]).toEqual({
      readOnly: true,
      destructiveCount: 0,
      sandboxDefault: "sandbox",
    });
  });

  it("compiles skillset pins into namespaced entries without agents index rows", async () => {
    const rootDir = await writeExampleRegistry();
    await writeJson(join(rootDir, "registry/external/tools.skillset.json"), {
      apiVersion: "quickdeploy.ai/v1",
      kind: "SkillSet",
      metadata: { name: "com.example/dev-tools", version: "1.0.0", labels: ["dev"] },
      spec: {
        skills: [
          {
            name: "external-skill",
            source: "example/repo",
            sourceType: "github",
            ref: "main",
            skillPath: "skills/external-skill/SKILL.md",
            computedHash: "b".repeat(64),
            summary: "External example skill.",
          },
        ],
      },
    });

    const artifacts = await buildRegistryArtifacts({ rootDir });
    expect(artifacts.skillsJson.agents).toHaveLength(1);
    const pinned = artifacts.skillsJson.skills.find(
      (skill) => skill.name === "com.example/external-skill",
    );
    expect(pinned?.contentHash).toBe("b".repeat(64));
    expect(pinned?._meta?.["ai.quickdeploy.registry/source"]).toEqual({
      source: "example/repo",
      sourceType: "github",
      ref: "main",
      skillPath: "skills/external-skill/SKILL.md",
    });
  });

  it("writes deterministic artifacts and detects drift", async () => {
    const rootDir = await writeExampleRegistry();
    await writeRegistryArtifacts({ rootDir });

    const first = await readFile(join(rootDir, "skills.json"), "utf8");
    await writeRegistryArtifacts({ rootDir });
    expect(await readFile(join(rootDir, "skills.json"), "utf8")).toBe(first);

    expect((await checkGeneratedRegistryArtifacts({ rootDir })).ok).toBe(true);

    const stale = `${first}\n// drift`;
    await writeJson(join(rootDir, "unrelated.json"), {});
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(rootDir, "skills.json"), stale, "utf8");
    const check = await checkGeneratedRegistryArtifacts({ rootDir });
    expect(check.ok).toBe(false);
    expect(check.changed).toEqual(["skills.json"]);
  });
});
