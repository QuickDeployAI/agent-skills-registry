import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildImporterScaffoldFiles,
  buildRegistryArtifacts,
  buildScaffoldSkillManifest,
  checkGeneratedRegistryArtifacts,
  validateRegistryEntries,
  writeImporterScaffold,
  writeRegistryArtifacts,
  writeScaffoldSkillManifest,
} from "../src";

let rootDir = "";

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "agent-skills-registry-cli-"));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

async function seedValidRegistry(): Promise<void> {
  await mkdir(path.join(rootDir, "skills", "quickdeploy", "demo", "references"), {
    recursive: true,
  });
  await mkdir(path.join(rootDir, "registry", "quickdeploy"), { recursive: true });
  await writeFile(
    path.join(rootDir, "skills", "quickdeploy", "demo", "SKILL.md"),
    ["---", "name: demo", "description: Use demo.", "---", "", "Use this skill.", ""].join("\n"),
  );
  await writeFile(
    path.join(rootDir, "skills", "quickdeploy", "demo", "references", "guide.md"),
    "# Guide\n",
  );
  await writeFile(
    path.join(rootDir, "registry", "quickdeploy", "demo.skill.json"),
    JSON.stringify(
      {
        apiVersion: "quickdeploy.ai/v1",
        kind: "AgentSkillManifest",
        metadata: {
          name: "ai.quickdeploy/demo",
          version: "0.1.0",
          description: "Use demo.",
        },
        spec: {
          source: { type: "file", uri: "skills/quickdeploy/demo" },
          package: {
            entrypoint: "SKILL.md",
            artifacts: { references: ["references/guide.md"] },
          },
        },
      },
      null,
      2,
    ),
  );
}

describe("agent skills registry CLI internals", () => {
  it("builds skills.json and registry/index.json", async () => {
    await seedValidRegistry();

    const artifacts = await buildRegistryArtifacts({ rootDir });
    expect(artifacts.skillsJson.skills[0]?.id).toBe("ai.quickdeploy/demo");
    expect(artifacts.skillsJson.skills[0]?.package.entrypoint).toBe("SKILL.md");
    expect(artifacts.registryIndex.agents[0]?.skill).toBe("../skills/quickdeploy/demo/SKILL.md");
    expect(
      new URL(
        artifacts.registryIndex.agents[0]!.skill,
        "https://raw.githubusercontent.com/QuickDeployAI/agent-skills-registry/main/registry/index.json",
      ).toString(),
    ).toBe(
      "https://raw.githubusercontent.com/QuickDeployAI/agent-skills-registry/main/skills/quickdeploy/demo/SKILL.md",
    );
    expect(await checkGeneratedRegistryArtifacts({ rootDir })).toEqual({
      ok: false,
      changed: ["skills.json", "registry/index.json"],
    });

    await writeRegistryArtifacts({ rootDir }, artifacts);
    expect(await readFile(path.join(rootDir, "skills.json"), "utf8")).toBe(
      artifacts.files["skills.json"],
    );
    expect(await checkGeneratedRegistryArtifacts({ rootDir })).toEqual({ ok: true, changed: [] });
  });

  it("validates namespace, duplicate ids, malformed skills, and missing artifacts", async () => {
    await seedValidRegistry();
    await writeFile(
      path.join(rootDir, "registry", "quickdeploy", "bad.skill.json"),
      JSON.stringify(
        {
          apiVersion: "quickdeploy.ai/v1",
          kind: "AgentSkillManifest",
          metadata: {
            name: "com.example/demo",
            version: "0.1.0",
            description: "Wrong namespace.",
          },
          spec: {
            source: { type: "file", uri: "skills/quickdeploy/demo" },
            package: {
              entrypoint: "SKILL.md",
              artifacts: { references: ["references/missing.md"] },
            },
          },
        },
        null,
        2,
      ),
    );

    const result = await validateRegistryEntries({ rootDir });
    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.code)).toContain("namespace-mismatch");
    expect(result.violations.map((violation) => violation.code)).toContain("missing-artifact");
  });

  it("scaffolds skill manifests and importers", () => {
    const manifest = buildScaffoldSkillManifest({
      name: "Example Skill",
      description: "Use the example skill.",
    });
    expect(manifest.metadata.name).toBe("ai.quickdeploy/example-skill");
    expect(manifest.spec.source.uri).toBe("skills/quickdeploy/example-skill");

    const files = buildImporterScaffoldFiles({ name: "widgets-2-agent-skills" });
    const byPath = new Map(files.map((file) => [file.path, file.content]));
    const packageJson = JSON.parse(
      byPath.get("packages/importers/widgets-2-agent-skills/package.json")!,
    ) as {
      name: string;
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(packageJson.name).toBe("@quickdeployai/widgets-2-agent-skills");
    expect(packageJson.dependencies).toMatchObject({
      "@quickdeployai/agent-skill-core": "workspace:*",
      "@quickdeployai/agent-skill-importer-core": "workspace:*",
    });
    expect(packageJson.scripts).toMatchObject({ typecheck: "tsc --noEmit", test: "vitest run" });

    const indexTs = byPath.get("packages/importers/widgets-2-agent-skills/src/index.ts")!;
    expect(indexTs).toContain("AgentSkillImporterResult");
    expect(indexTs).toContain("manifestDraft");
    expect(indexTs).toContain("stableJson(manifestDraft)");

    const indexTest = byPath.get(
      "packages/importers/widgets-2-agent-skills/src/index.test.ts",
    )!;
    expect(indexTest).toContain("ai.quickdeploy/demo-cli");

    expect(() => buildImporterScaffoldFiles({ name: "widgets-2-mcp" })).toThrow(/agent-skills/);
  });

  it("writes scaffolded manifests and importer packages", async () => {
    const manifestResult = await writeScaffoldSkillManifest(rootDir, {
      name: "Example Skill",
      description: "Use the example skill.",
    });
    expect(manifestResult.path).toBe(
      path.join(rootDir, "registry", "quickdeploy", "example-skill.skill.json"),
    );
    expect(JSON.parse(await readFile(manifestResult.path, "utf8")).metadata.name).toBe(
      "ai.quickdeploy/example-skill",
    );

    const written = await writeImporterScaffold(rootDir, {
      name: "widgets-2-agent-skills",
    });
    expect(written).toEqual(
      expect.arrayContaining([
        path.join(
          rootDir,
          "packages",
          "importers",
          "widgets-2-agent-skills",
          "package.json",
        ),
        path.join(
          rootDir,
          "packages",
          "importers",
          "widgets-2-agent-skills",
          "src",
          "index.ts",
        ),
      ]),
    );

    await expect(
      writeImporterScaffold(rootDir, { name: "widgets-2-agent-skills" }),
    ).rejects.toThrow();
  });
});
