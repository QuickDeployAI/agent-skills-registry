import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillManifest } from "@quickdeployai/skill-registry-schemas";
import { generateSkillFiles } from "../src/index.js";

async function fixture(): Promise<string> {
  return readFile(join(import.meta.dirname, "fixtures", "petstore.json"), "utf8");
}

type Request = { method: "GET" | "POST" | "DELETE"; uriTemplate: string };

function manifest(requests: Request[], mode?: string): SkillManifest {
  return {
    apiVersion: "quickdeploy.ai/v1",
    kind: "SkillManifest",
    metadata: { name: "ai.quickdeploy/petstore-operator", version: "0.1.0", labels: [] },
    spec: {
      importer: { engine: "openapi-2-agent-skills", versionRange: "^0.1.0" },
      source: {
        type: "http",
        uri: "https://example.com/petstore.json",
        digest: `sha256:${"a".repeat(64)}`,
      },
      select: { requests },
      ...(mode === undefined ? {} : { config: { defaults: { mode } } }),
      skill: { name: "petstore-operator", description: "Operate the petstore." },
      safety: {
        readOnly: true,
        destructiveOperations: [],
        sandbox: { supported: true, defaultMode: "sandbox" },
        secretsPolicy: "env-names-only",
      },
      references: [],
      scripts: [],
      output: { path: "skills/quickdeploy/petstore-operator" },
    },
  };
}

describe("openapi-2-agent-skills", () => {
  it("generates a deterministic endpoint reference with write operations flagged", async () => {
    const source = await fixture();
    const requests: Request[] = [
      { method: "GET", uriTemplate: "/pets" },
      { method: "GET", uriTemplate: "/pets/{petId}" },
      { method: "DELETE", uriTemplate: "/pets/{petId}" },
    ];
    const result = generateSkillFiles(manifest(requests), source);
    const content = result.files["references/api-endpoints.md"];

    expect(Object.keys(result.files)).toEqual(["references/api-endpoints.md"]);
    expect(content).toContain("# Petstore endpoint reference");
    expect(content).toContain("## GET `/pets`");
    expect(content).toContain("| `limit` | query | no |");
    expect(content).toContain("## DELETE `/pets/{petId}` (write)");
    expect(content).toContain("explicit user confirmation");
    expect(generateSkillFiles(manifest(requests), source).files).toEqual(result.files);
  });

  it("rejects write selections in read-only mode and unknown operations", async () => {
    const source = await fixture();
    expect(() =>
      generateSkillFiles(manifest([{ method: "DELETE", uriTemplate: "/pets/{petId}" }], "read-only"), source),
    ).toThrow(/read-only mode forbids write selections/);
    expect(() =>
      generateSkillFiles(manifest([{ method: "GET", uriTemplate: "/missing" }]), source),
    ).toThrow(/not found in the OpenAPI document/);
  });
});
