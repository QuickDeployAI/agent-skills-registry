import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillManifest } from "@quickdeployai/skill-registry-schemas";
import { generateSkillFiles } from "../src/index.js";

async function fixture(): Promise<string> {
  return readFile(join(import.meta.dirname, "fixtures", "stripe-help-dump.json"), "utf8");
}

function manifest(commands: { command: string; destructive?: boolean }[]): SkillManifest {
  return {
    apiVersion: "quickdeploy.ai/v1",
    kind: "SkillManifest",
    metadata: { name: "ai.quickdeploy/stripe-payments-operator", version: "0.1.0", labels: [] },
    spec: {
      importer: { engine: "cli-2-agent-skills", versionRange: "^0.1.0" },
      source: { type: "file", uri: "sources/stripe/stripe-cli-help.json" },
      select: { commands: commands.map((c) => ({ command: c.command, destructive: c.destructive ?? false })) },
      skill: { name: "stripe-payments-operator", description: "Operate Stripe payments." },
      safety: {
        readOnly: false,
        destructiveOperations: [
          { name: "refund-payment", description: "Refund a charge.", confirmation: "explicit" },
        ],
        sandbox: { supported: true, defaultMode: "sandbox" },
        secretsPolicy: "env-names-only",
      },
      references: [],
      scripts: [],
      output: { path: "skills/quickdeploy/stripe-payments-operator" },
    },
  };
}

describe("cli-2-agent-skills", () => {
  it("generates a deterministic command reference with destructive commands separated", async () => {
    const source = await fixture();
    const selected = [
      { command: "payment_intents list" },
      { command: "refunds create", destructive: true },
    ];
    const result = generateSkillFiles(manifest(selected), source);
    const content = result.files["references/cli-commands.md"];

    expect(Object.keys(result.files)).toEqual(["references/cli-commands.md"]);
    expect(content).toContain("## Safe commands");
    expect(content).toContain("- `stripe payment_intents list`");
    expect(content).toContain("## Destructive commands — explicit confirmation required");
    expect(content).toContain("- `stripe refunds create`");
    expect(content).toContain("### `stripe refunds create` (destructive)");

    // Deterministic: same input, same output.
    expect(generateSkillFiles(manifest(selected), source).files).toEqual(result.files);
  });

  it("fails on commands missing from the help dump and on empty selection", async () => {
    const source = await fixture();
    expect(() => generateSkillFiles(manifest([{ command: "nope list" }]), source)).toThrow(
      /missing from help dump: nope list/,
    );
    expect(() => generateSkillFiles(manifest([]), source)).toThrow(/at least one command/);
  });
});
