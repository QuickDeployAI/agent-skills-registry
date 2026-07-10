import { assertSafeRelativePath } from "@quickdeployai/agent-skill-core";

export type ImporterDiagnosticSeverity = "info" | "warning" | "error";

export interface ImporterDiagnostic {
  severity: ImporterDiagnosticSeverity;
  message: string;
  path?: string;
}

export interface ImporterGeneratedFile {
  path: string;
  content: string;
}

export interface AgentSkillImporterResult<TManifestDraft = unknown> {
  files: ImporterGeneratedFile[];
  diagnostics: ImporterDiagnostic[];
  manifestDraft?: TManifestDraft;
}

export function normalizeGeneratedFiles(files: readonly ImporterGeneratedFile[]): ImporterGeneratedFile[] {
  const seen = new Set<string>();
  return [...files]
    .map((file) => {
      const safePath = assertSafeRelativePath(file.path);
      if (seen.has(safePath)) throw new Error(`Duplicate generated file path: ${safePath}`);
      seen.add(safePath);
      return { path: safePath, content: file.content.endsWith("\n") ? file.content : `${file.content}\n` };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function hasBlockingDiagnostics(diagnostics: readonly ImporterDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
