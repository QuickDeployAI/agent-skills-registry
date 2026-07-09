#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getSkillImporterConfigSchema } from "@quickdeployai/skill-registry-schemas";
import {
  buildRegistryArtifacts,
  checkGeneratedRegistryArtifacts,
  stableJson,
  writeRegistryArtifacts,
} from "./registry-build.js";
import {
  formatRegistryValidationViolations,
  validateRegistryEntries,
} from "./registry-validate.js";
import { scaffoldSkill } from "./scaffold.js";

function usage(): string {
  return [
    "Usage: skills-cli build [--root <dir>] [--check]",
    "       skills-cli validate [--root <dir>]",
    "       skills-cli config-schema --importer <engine>",
    "       skills-cli scaffold skill <provider>/<name> --description <text> [--title <text>] [--force]",
    "",
    "Builds skills.json from registry/<provider> skill manifests and skillset pins.",
  ].join("\n");
}

interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index] ?? "";
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(name, next);
      index += 1;
    } else {
      flags.set(name, true);
    }
  }

  return { command, positionals, flags };
}

function stringFlag(flags: Map<string, string | boolean>, name: string): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(startDir);
    current = parent;
  }
}

async function main(): Promise<number> {
  const { command, positionals, flags } = parseArgs(process.argv.slice(2));
  const rootDir = stringFlag(flags, "root") ?? findWorkspaceRoot(process.cwd());

  switch (command) {
    case "build": {
      if (flags.get("check") === true) {
        const result = await checkGeneratedRegistryArtifacts({ rootDir });
        if (!result.ok) {
          process.stderr.write(
            `Generated artifacts are stale: ${result.changed.join(", ")}. Run "skills-cli build".\n`,
          );
          return 1;
        }
        process.stdout.write("Generated artifacts are up to date.\n");
        return 0;
      }
      const artifacts = await buildRegistryArtifacts({ rootDir });
      await writeRegistryArtifacts({ rootDir }, artifacts);
      process.stdout.write(
        `Wrote skills.json with ${artifacts.skillsJson.skills.length} skill entr${artifacts.skillsJson.skills.length === 1 ? "y" : "ies"} (${artifacts.skillsJson.agents.length} in the agents index).\n`,
      );
      return 0;
    }

    case "validate": {
      const result = await validateRegistryEntries({ rootDir });
      process.stdout.write(formatRegistryValidationViolations(result.violations));
      if (!result.ok) return 1;
      process.stdout.write(`Validated ${result.entryCount} registry source(s).\n`);
      return 0;
    }

    case "config-schema": {
      const engine = stringFlag(flags, "importer");
      if (!engine) {
        process.stderr.write("config-schema requires --importer <engine>.\n");
        return 1;
      }
      const schema = getSkillImporterConfigSchema(engine);
      if (!schema) {
        process.stderr.write(`No config schema registered for importer "${engine}".\n`);
        return 1;
      }
      process.stdout.write(stableJson(schema));
      return 0;
    }

    case "scaffold": {
      const [kind, slug] = positionals;
      if (kind !== "skill" || !slug) {
        process.stderr.write(`${usage()}\n`);
        return 1;
      }
      const [provider, skillName, ...extra] = slug.split("/");
      if (!provider || !skillName || extra.length > 0) {
        process.stderr.write('scaffold skill expects a "<provider>/<name>" slug.\n');
        return 1;
      }
      const description = stringFlag(flags, "description");
      if (!description) {
        process.stderr.write("scaffold skill requires --description <text>.\n");
        return 1;
      }
      const title = stringFlag(flags, "title");
      const result = await scaffoldSkill({
        rootDir,
        provider,
        skillName,
        description,
        ...(title === undefined ? {} : { title }),
        force: flags.get("force") === true,
      });
      process.stdout.write(
        `Scaffolded ${result.skillDir} and ${result.manifestPath}. Run "skills-cli build" to regenerate skills.json.\n`,
      );
      return 0;
    }

    case "help":
    case "--help":
    case "": {
      process.stdout.write(`${usage()}\n`);
      return command === "" ? 1 : 0;
    }

    default: {
      process.stderr.write(`Unknown command "${command}".\n\n${usage()}\n`);
      return 1;
    }
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  },
);
