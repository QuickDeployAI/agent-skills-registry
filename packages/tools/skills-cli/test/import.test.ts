import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runImport } from "../src/import.js";
import { exampleManifest, writeJson } from "./helpers.js";

const CLI_FIXTURE = join(
  import.meta.dirname,
  "../../../importers/cli-2-agent-skills/test/fixtures/stripe-help-dump.json",
);

async function writeImportRegistry(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "skills-cli-import-"));
  await cp(CLI_FIXTURE, join(rootDir, "sources/stripe/stripe-cli-help.json"));

  const manifest = exampleManifest();
  manifest.spec.importer = { engine: "cli-2-agent-skills", versionRange: "^0.1.0" };
  manifest.spec.source = { type: "file", uri: "sources/stripe/stripe-cli-help.json" };
  manifest.spec.select = {
    commands: [
      { command: "payment_intents list", destructive: false },
      { command: "refunds create", destructive: true },
    ],
  };
  await writeJson(join(rootDir, "registry/quickdeploy/example-skill.skill.json"), manifest);
  return rootDir;
}

describe("runImport", () => {
  it("runs the manifest's engine and writes generated references under output.path", async () => {
    const rootDir = await writeImportRegistry();
    const result = await runImport({
      rootDir,
      manifestPath: "registry/quickdeploy/example-skill.skill.json",
    });

    expect(result.engine).toBe("cli-2-agent-skills");
    expect(result.written).toEqual(["references/cli-commands.md"]);
    const generated = await readFile(
      join(rootDir, "skills/quickdeploy/example-skill/references/cli-commands.md"),
      "utf8",
    );
    expect(generated).toContain("## Destructive commands");
  });

  it("rejects hand-authored manifests and unknown engines", async () => {
    const rootDir = await writeImportRegistry();
    const handAuthored = exampleManifest();
    await writeJson(join(rootDir, "registry/quickdeploy/hand.skill.json"), handAuthored);
    await expect(
      runImport({ rootDir, manifestPath: "registry/quickdeploy/hand.skill.json" }),
    ).rejects.toThrow(/hand-authored/);

    const unknown = exampleManifest();
    unknown.spec.importer = { engine: "nope-2-agent-skills", versionRange: "^0.1.0" };
    await writeJson(join(rootDir, "registry/quickdeploy/unknown.skill.json"), unknown);
    await expect(
      runImport({ rootDir, manifestPath: "registry/quickdeploy/unknown.skill.json" }),
    ).rejects.toThrow(/Unknown importer engine/);
  });
});
