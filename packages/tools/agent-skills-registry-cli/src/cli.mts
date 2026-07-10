#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getImporterConfigSchema } from "@quickdeployai/agent-skill-registry-schemas";
import {
  buildRegistryArtifacts,
  checkGeneratedRegistryArtifacts,
  writeRegistryArtifacts,
} from "./registry-build";
import { formatRegistryValidationViolations, validateRegistryEntries } from "./registry-validate";
import { writeImporterScaffold, writeScaffoldSkillManifest } from "./scaffold";

function usage(): string {
  return [
    "Usage: agent-skills-registry-cli build [--root <dir>] [--check]",
    "       agent-skills-registry-cli check [--root <dir>]",
    "       agent-skills-registry-cli validate [--root <dir>]",
    "       agent-skills-registry-cli config-schema --importer <engine>",
    "       agent-skills-registry-cli scaffold importer <name> [--description <text>] [--force]",
    "       agent-skills-registry-cli scaffold skill-manifest --name <name> --description <text>",
    "             [--source-uri <path>] [--publisher <publisher>] [--out <path>] [--force]",
  ].join("\n");
}

type FlagArgs = {
  positionals: string[];
  values: Map<string, string[]>;
  flags: Set<string>;
};

function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(startDir);
    current = parent;
  }
}

function parseFlagArgs(argv: string[], booleanFlags: Set<string>): FlagArgs {
  const positionals: string[] = [];
  const values = new Map<string, string[]>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (booleanFlags.has(name)) {
      flags.add(name);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`--${name} requires a value.`);
    values.set(name, [...(values.get(name) ?? []), value]);
    index += 1;
  }

  return { positionals, values, flags };
}

function firstValue(args: FlagArgs, name: string): string | undefined {
  return args.values.get(name)?.[0];
}

function requireValue(args: FlagArgs, name: string): string {
  const value = firstValue(args, name);
  if (!value) throw new Error(`--${name} requires a value.`);
  return value;
}

async function run(argv: string[]): Promise<void> {
  const args = parseFlagArgs(argv, new Set(["check", "force", "help"]));
  if (args.flags.has("help") || argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const [command = "build", subcommand] = args.positionals;
  const rootDir = firstValue(args, "root") ?? findWorkspaceRoot(process.cwd());

  if (command === "build") {
    if (args.flags.has("check")) {
      const result = await checkGeneratedRegistryArtifacts({ rootDir });
      if (!result.ok) {
        process.stderr.write(`Generated registry artifacts are out of date: ${result.changed.join(", ")}\n`);
        process.exitCode = 1;
      }
      return;
    }
    await writeRegistryArtifacts({ rootDir });
    process.stdout.write("Wrote skills.json and registry/index.json\n");
    return;
  }

  if (command === "check") {
    const result = await checkGeneratedRegistryArtifacts({ rootDir });
    if (!result.ok) {
      process.stderr.write(`Generated registry artifacts are out of date: ${result.changed.join(", ")}\n`);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "validate") {
    const result = await validateRegistryEntries({ rootDir });
    process.stdout.write(formatRegistryValidationViolations(result.violations));
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "config-schema") {
    const importer = requireValue(args, "importer");
    const schema = getImporterConfigSchema(importer);
    if (!schema) throw new Error(`No config schema registered for importer: ${importer}`);
    process.stdout.write(`${JSON.stringify(schema, null, 2)}\n`);
    return;
  }

  if (command === "scaffold" && subcommand === "importer") {
    const name = args.positionals[2];
    if (!name) throw new Error("scaffold importer requires a name.");
    const files = await writeImporterScaffold(
      rootDir,
      {
        name,
        description: firstValue(args, "description"),
      },
      args.flags.has("force"),
    );
    process.stdout.write(`Wrote ${files.length} importer scaffold files.\n`);
    return;
  }

  if (command === "scaffold" && subcommand === "skill-manifest") {
    const result = await writeScaffoldSkillManifest(
      rootDir,
      {
        name: requireValue(args, "name"),
        description: requireValue(args, "description"),
        title: firstValue(args, "title"),
        publisher: firstValue(args, "publisher"),
        sourceUri: firstValue(args, "source-uri"),
        outPath: firstValue(args, "out"),
      },
      args.flags.has("force"),
    );
    process.stdout.write(`Wrote ${result.path}\n`);
    return;
  }

  throw new Error(`Unknown command.\n${usage()}`);
}

run(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
