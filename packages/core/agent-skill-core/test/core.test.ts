import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isSafeRelativePath,
  loadSkillPackage,
  parseSkillMarkdown,
  renderSkillMarkdown,
  slugify,
  stableJson,
} from "../src";

let tempRoot = "";

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "agent-skill-core-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("agent-skill-core", () => {
  it("parses and renders SKILL.md frontmatter", () => {
    const markdown = renderSkillMarkdown(
      {
        name: "registry-author",
        description: "Author registry entries",
        metadata: { owner: "platform" },
      },
      "Use this skill.",
    );

    expect(parseSkillMarkdown(markdown).frontmatter.metadata).toEqual({ owner: "platform" });
    expect(() => parseSkillMarkdown("missing frontmatter")).toThrow(/frontmatter/);
  });

  it("loads package artifacts and rejects unsafe paths", async () => {
    await mkdir(path.join(tempRoot, "references", "deep"), { recursive: true });
    await mkdir(path.join(tempRoot, "assets"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "SKILL.md"),
      renderSkillMarkdown(
        { name: "registry-author", description: "Author registry entries" },
        "Use this skill.",
      ),
    );
    await writeFile(path.join(tempRoot, "references", "deep", "guide.md"), "# Guide\n");
    await writeFile(path.join(tempRoot, "assets", "icon.svg"), "<svg />\n");

    const loaded = await loadSkillPackage(tempRoot);
    expect(loaded.artifacts.references).toEqual(["deep/guide.md"]);
    expect(loaded.artifacts.assets).toEqual(["icon.svg"]);
    expect(isSafeRelativePath("../escape")).toBe(false);
  });

  it("slugifies and emits stable JSON", () => {
    expect(slugify("Quick Deploy CLI")).toBe("quick-deploy-cli");
    expect(stableJson({ z: 1, a: { c: 3, b: 2 } })).toBe(
      '{\n  "a": {\n    "b": 2,\n    "c": 3\n  },\n  "z": 1\n}\n',
    );
  });
});
