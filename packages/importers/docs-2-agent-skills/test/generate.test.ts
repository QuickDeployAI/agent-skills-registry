import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillManifest } from "@quickdeployai/skill-registry-schemas";
import { generateSkillFiles } from "../src/index.js";

async function fixture(): Promise<string> {
  return readFile(join(import.meta.dirname, "fixtures", "qbo-bundle.json"), "utf8");
}

function manifest(docGlobs: string[]): SkillManifest {
  return {
    apiVersion: "quickdeploy.ai/v1",
    kind: "SkillManifest",
    metadata: { name: "ai.quickdeploy/quickbooks-bookkeeping", version: "0.1.0", labels: [] },
    spec: {
      importer: { engine: "docs-2-agent-skills", versionRange: "^0.1.0" },
      source: { type: "file", uri: "sources/quickbooks/docs-bundle.json" },
      select: { docGlobs },
      skill: { name: "quickbooks-bookkeeping", description: "Operate QuickBooks bookkeeping." },
      safety: {
        readOnly: true,
        destructiveOperations: [],
        sandbox: { supported: true, defaultMode: "sandbox" },
        secretsPolicy: "env-names-only",
      },
      references: [],
      scripts: [],
      output: { path: "skills/quickdeploy/quickbooks-bookkeeping" },
    },
  };
}

describe("docs-2-agent-skills", () => {
  it("generates page references and CSV column maps with validation rules", async () => {
    const source = await fixture();
    const result = generateSkillFiles(manifest(["Categorize*", "Invoice export"]), source);

    expect(Object.keys(result.files).sort()).toEqual([
      "references/docs-categorize-bank-transactions.md",
      "references/export-invoice-export.md",
    ]);
    expect(result.files["references/docs-categorize-bank-transactions.md"]).toContain(
      "Match transfers to existing entries",
    );
    const csv = result.files["references/export-invoice-export.md"];
    expect(csv).toContain("| `Amount` | decimal | yes |");
    expect(csv).toContain("> 0, two decimal places");
    expect(csv).toContain("Reject rows that violate a validation rule");

    expect(generateSkillFiles(manifest(["Categorize*", "Invoice export"]), source).files).toEqual(
      result.files,
    );
  });

  it("fails loudly on globs that match nothing and empty selections", async () => {
    const source = await fixture();
    expect(() => generateSkillFiles(manifest(["Payroll*"]), source)).toThrow(
      /matched nothing in the bundle: Payroll\*/,
    );
    expect(() => generateSkillFiles(manifest([]), source)).toThrow(/at least one docGlob/);
  });
});
