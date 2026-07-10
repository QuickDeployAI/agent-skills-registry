import { describe, expect, it } from "vitest";
import { hasBlockingDiagnostics, normalizeGeneratedFiles } from "../src";

describe("agent-skill-importer-core", () => {
  it("normalizes generated files deterministically", () => {
    expect(
      normalizeGeneratedFiles([
        { path: "b.txt", content: "b" },
        { path: "a.txt", content: "a\n" },
      ]),
    ).toEqual([
      { path: "a.txt", content: "a\n" },
      { path: "b.txt", content: "b\n" },
    ]);
  });

  it("rejects unsafe and duplicate generated paths", () => {
    expect(() => normalizeGeneratedFiles([{ path: "../escape", content: "" }])).toThrow(/Unsafe/);
    expect(() =>
      normalizeGeneratedFiles([
        { path: "same.txt", content: "a" },
        { path: "same.txt", content: "b" },
      ]),
    ).toThrow(/Duplicate/);
  });

  it("detects blocking diagnostics", () => {
    expect(hasBlockingDiagnostics([{ severity: "warning", message: "review" }])).toBe(false);
    expect(hasBlockingDiagnostics([{ severity: "error", message: "broken" }])).toBe(true);
  });
});
