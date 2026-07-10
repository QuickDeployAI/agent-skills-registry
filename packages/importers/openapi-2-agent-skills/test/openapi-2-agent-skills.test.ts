import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openApiToAgentSkill } from "../src";

const fixtureRoot = join(import.meta.dirname, "fixtures");

describe("openapi-2-agent-skills", () => {
  it("generates skill files and operation references from an OpenAPI document", () => {
    const document = JSON.parse(
      readFileSync(join(fixtureRoot, "acme-pets.openapi.json"), "utf8"),
    ) as Parameters<typeof openApiToAgentSkill>[0]["document"];

    const result = openApiToAgentSkill({
      document,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.manifestDraft?.metadata.name).toBe("ai.quickdeploy/acme-pets");
    expect(result.files.map((file) => file.path)).toEqual([
      "registry/quickdeploy/acme-pets.skill.json",
      "skills/quickdeploy/acme-pets/references/openapi.json",
      "skills/quickdeploy/acme-pets/references/operations.md",
      "skills/quickdeploy/acme-pets/SKILL.md",
    ]);
    expect(result.files.find((file) => file.path.endsWith("operations.md"))?.content).toContain(
      "GET /pets",
    );
  });

  it("warns when no operations are available", () => {
    const result = openApiToAgentSkill({ document: { info: { title: "Empty API" } } });
    expect(result.diagnostics.map((diagnostic) => diagnostic.severity)).toEqual([
      "warning",
      "warning",
    ]);
  });
});
