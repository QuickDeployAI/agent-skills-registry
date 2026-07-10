import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cliToAgentSkill } from "../src";

const fixtureRoot = join(import.meta.dirname, "fixtures");

describe("cli-2-agent-skills", () => {
  it("generates deterministic skill files and a manifest draft", () => {
    const result = cliToAgentSkill({
      commandName: "qdai",
      helpText: readFileSync(join(fixtureRoot, "qdai-help.txt"), "utf8"),
      examples: ["qdai deploy --dry-run"],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.manifestDraft?.metadata.name).toBe("ai.quickdeploy/qdai");
    expect(result.files.map((file) => file.path)).toEqual([
      "registry/quickdeploy/qdai.skill.json",
      "skills/quickdeploy/qdai/references/help.txt",
      "skills/quickdeploy/qdai/SKILL.md",
    ]);
    expect(result.files.find((file) => file.path.endsWith("SKILL.md"))?.content).toContain(
      "Reviewed Examples",
    );
  });

  it("reports blocking diagnostics for missing inputs", () => {
    const result = cliToAgentSkill({ commandName: "", helpText: "" });
    expect(result.diagnostics.map((diagnostic) => diagnostic.severity)).toEqual(["error", "error"]);
    expect(result.files).toEqual([]);
  });
});
