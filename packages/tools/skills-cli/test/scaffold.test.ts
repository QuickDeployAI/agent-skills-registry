import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegistryArtifacts } from "../src/registry-build.js";
import { validateRegistryEntries } from "../src/registry-validate.js";
import { scaffoldSkill } from "../src/scaffold.js";

describe("scaffoldSkill", () => {
  it("scaffolds a skill that immediately passes validate and build", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "skills-cli-scaffold-"));
    const result = await scaffoldSkill({
      rootDir,
      provider: "quickdeploy",
      skillName: "cashflow-pulse",
      description: "Summarize daily receivables and payment failures.",
      title: "Cashflow Pulse",
    });

    const skillMd = await readFile(join(result.skillDir, "SKILL.md"), "utf8");
    expect(skillMd).toContain("name: cashflow-pulse");
    expect(skillMd).toContain("ai.quickdeploy.skills/read-only");

    const validation = await validateRegistryEntries({ rootDir });
    expect(validation.violations).toEqual([]);

    const artifacts = await buildRegistryArtifacts({ rootDir });
    expect(artifacts.skillsJson.agents[0]?.skill).toBe(
      "skills/quickdeploy/cashflow-pulse/SKILL.md",
    );
  });

  it("refuses to overwrite existing files without --force and rejects bad slugs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "skills-cli-scaffold-"));
    const options = {
      rootDir,
      provider: "quickdeploy",
      skillName: "cashflow-pulse",
      description: "Summarize daily receivables.",
    };
    await scaffoldSkill(options);
    await expect(scaffoldSkill(options)).rejects.toThrow(/Refusing to overwrite/);
    await expect(scaffoldSkill({ ...options, force: true })).resolves.toBeDefined();

    await expect(
      scaffoldSkill({ ...options, skillName: "Bad_Name" }),
    ).rejects.toThrow(/kebab-case/);
  });
});
