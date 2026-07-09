import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillManifest } from "@quickdeployai/skill-registry-schemas";
import { generateSkillFiles } from "../src/index.js";

async function fixture(): Promise<string> {
  return readFile(join(import.meta.dirname, "fixtures", "shop.graphql"), "utf8");
}

type Operation = { type: "query" | "mutation"; name: string };

function manifest(operations: Operation[]): SkillManifest {
  return {
    apiVersion: "quickdeploy.ai/v1",
    kind: "SkillManifest",
    metadata: { name: "ai.quickdeploy/shopify-store-operator", version: "0.1.0", labels: [] },
    spec: {
      importer: { engine: "graphql-2-agent-skills", versionRange: "^0.1.0" },
      source: { type: "file", uri: "sources/shopify/admin-subset.graphql" },
      select: { graphqlOperations: operations },
      skill: { name: "shopify-store-operator", description: "Operate a Shopify store." },
      safety: {
        readOnly: false,
        destructiveOperations: [
          { name: "product-update", description: "Updates a product.", confirmation: "explicit" },
        ],
        sandbox: { supported: true, defaultMode: "sandbox" },
        secretsPolicy: "env-names-only",
      },
      references: [],
      scripts: [],
      output: { path: "skills/quickdeploy/shopify-store-operator" },
    },
  };
}

describe("graphql-2-agent-skills", () => {
  it("generates operation references with mutation safety checklists", async () => {
    const source = await fixture();
    const operations: Operation[] = [
      { type: "query", name: "orders" },
      { type: "mutation", name: "productUpdate" },
    ];
    const result = generateSkillFiles(manifest(operations), source);
    const content = result.files["references/graphql-operations.md"];

    expect(Object.keys(result.files)).toEqual(["references/graphql-operations.md"]);
    expect(content).toContain("## query `orders`");
    expect(content).toContain("List orders, most recent first.");
    expect(content).toContain("## mutation `productUpdate` (write)");
    expect(content).toContain("Safe-operation checklist before calling:");
    expect(content).toContain("Check `userErrors` in the response");
    expect(generateSkillFiles(manifest(operations), source).files).toEqual(result.files);
  });

  it("fails on operations missing from the schema and empty selections", async () => {
    const source = await fixture();
    expect(() =>
      generateSkillFiles(manifest([{ type: "mutation", name: "productDelete" }]), source),
    ).toThrow(/missing from the schema: mutation.productDelete/);
    expect(() => generateSkillFiles(manifest([]), source)).toThrow(/at least one operation/);
  });
});
