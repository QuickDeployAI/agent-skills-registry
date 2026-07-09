import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fetchTextSource } from "@quickdeployai/skill-core";
import { SkillManifestSchema, type SkillManifest } from "@quickdeployai/skill-registry-schemas";
import { generateSkillFiles as cliEngine } from "@quickdeployai/cli-2-agent-skills";
import { generateSkillFiles as docsEngine } from "@quickdeployai/docs-2-agent-skills";
import { generateSkillFiles as graphqlEngine } from "@quickdeployai/graphql-2-agent-skills";
import { generateSkillFiles as openapiEngine } from "@quickdeployai/openapi-2-agent-skills";

export type ImporterEngine = (
  manifest: SkillManifest,
  sourceText: string,
) => { files: Record<string, string> };

export const IMPORTER_ENGINES: Record<string, ImporterEngine> = {
  "cli-2-agent-skills": cliEngine,
  "openapi-2-agent-skills": openapiEngine,
  "docs-2-agent-skills": docsEngine,
  "graphql-2-agent-skills": graphqlEngine,
};

export interface RunImportOptions {
  rootDir: string;
  manifestPath: string;
}

export interface RunImportResult {
  engine: string;
  outputPath: string;
  written: string[];
}

const GENERATED_PATH_PATTERN = /^(references|assets)\/[A-Za-z0-9._/-]+$/;

/**
 * Run a manifest's importer engine: fetch the digest-verified source,
 * generate reference files, and write them under `spec.output.path`.
 * Generated files are confined to references/ and assets/ — importers never
 * write SKILL.md (curated by hand) or scripts/ (executable surface).
 */
export async function runImport(options: RunImportOptions): Promise<RunImportResult> {
  const manifestFile = join(options.rootDir, options.manifestPath);
  const manifest = SkillManifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));

  const engineName = manifest.spec.importer?.engine;
  if (!engineName) {
    throw new Error(`${options.manifestPath} is hand-authored (no spec.importer); nothing to import.`);
  }
  const engine = IMPORTER_ENGINES[engineName];
  if (!engine) {
    throw new Error(
      `Unknown importer engine "${engineName}". Known engines: ${Object.keys(IMPORTER_ENGINES).sort().join(", ")}.`,
    );
  }

  const sourceText = await fetchTextSource(manifest.spec.source.uri, {
    cwd: options.rootDir,
    ...(manifest.spec.source.digest === undefined ? {} : { digest: manifest.spec.source.digest }),
  });

  const generated = engine(manifest, sourceText);
  const written: string[] = [];

  for (const [relativePath, content] of Object.entries(generated.files)) {
    if (!GENERATED_PATH_PATTERN.test(relativePath) || relativePath.includes("..")) {
      throw new Error(
        `Importer produced unsafe output path "${relativePath}" (must stay under references/ or assets/).`,
      );
    }
    const target = join(options.rootDir, manifest.spec.output.path, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    written.push(relativePath);
  }

  return {
    engine: engineName,
    outputPath: manifest.spec.output.path,
    written: written.sort(),
  };
}
