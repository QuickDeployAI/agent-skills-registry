import { describe, expect, it } from "vitest";
import {
  AgentSkillManifestSchema,
  AgentSkillsJsonEnvelopeSchema,
  getImporterConfigSchema,
} from "../src";

const manifest = {
  apiVersion: "quickdeploy.ai/v1",
  kind: "AgentSkillManifest",
  metadata: {
    name: "ai.quickdeploy/registry-author",
    version: "0.1.0",
    description: "Author registry entries.",
  },
  spec: {
    source: {
      type: "file",
      uri: "skills/quickdeploy/registry-author",
    },
    package: {
      entrypoint: "SKILL.md",
      artifacts: {
        references: ["references/guide.md"],
      },
    },
  },
};

describe("agent skill registry schemas", () => {
  it("accepts a minimal valid AgentSkillManifest", () => {
    const parsed = AgentSkillManifestSchema.parse(manifest);
    expect(parsed.spec.package.entrypoint).toBe("SKILL.md");
    expect(parsed.spec.compatibility.agents).toEqual([]);
  });

  it("rejects version ranges and unsafe artifact paths", () => {
    expect(() =>
      AgentSkillManifestSchema.parse({
        ...manifest,
        metadata: { ...manifest.metadata, version: "^0.1.0" },
      }),
    ).toThrow(/exact semver/);

    expect(() =>
      AgentSkillManifestSchema.parse({
        ...manifest,
        spec: {
          ...manifest.spec,
          package: {
            entrypoint: "../SKILL.md",
          },
        },
      }),
    ).toThrow(/safe and relative/);
  });

  it("rejects duplicate ids in skills.json", () => {
    const entry = {
      id: "ai.quickdeploy/registry-author",
      name: "registry-author",
      version: "0.1.0",
      description: "Author registry entries.",
      skill: "skills/quickdeploy/registry-author/SKILL.md",
      source: { type: "file", uri: "skills/quickdeploy/registry-author" },
      package: {
        entrypoint: "SKILL.md",
        artifacts: { scripts: [], references: [], assets: [] },
      },
      artifacts: { scripts: [], references: [], assets: [] },
      compatibility: { agents: [], models: [], tools: [] },
      safety: { status: "review", permissions: [], secrets: [] },
      curation: { verifiedStatus: "review", tags: [] },
      _meta: {},
    };

    expect(() => AgentSkillsJsonEnvelopeSchema.parse({ skills: [entry, entry] })).toThrow(
      /duplicate skill id/,
    );
  });

  it("exposes importer config schemas", () => {
    expect(getImporterConfigSchema("cli-2-agent-skills")?.required).toContain("commandName");
    expect(getImporterConfigSchema("missing")).toBeUndefined();
  });
});
