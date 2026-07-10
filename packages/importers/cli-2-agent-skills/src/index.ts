import { renderSkillMarkdown, slugify, stableJson } from "@quickdeployai/agent-skill-core";
import {
  normalizeGeneratedFiles,
  type AgentSkillImporterResult,
  type ImporterDiagnostic,
} from "@quickdeployai/agent-skill-importer-core";

export interface CliToAgentSkillsOptions {
  commandName: string;
  helpText: string;
  description?: string;
  namespace?: string;
  publisher?: string;
  version?: string;
  examples?: string[];
}

export interface CliSkillManifestDraft {
  apiVersion: "quickdeploy.ai/v1";
  kind: "AgentSkillManifest";
  metadata: {
    name: string;
    version: string;
    description: string;
    labels: string[];
  };
  spec: {
    source: {
      type: "file";
      uri: string;
    };
    package: {
      entrypoint: "SKILL.md";
      artifacts: {
        references: string[];
        scripts: string[];
        assets: string[];
      };
    };
  };
}

export function cliToAgentSkill(
  options: CliToAgentSkillsOptions,
): AgentSkillImporterResult<CliSkillManifestDraft> {
  const diagnostics: ImporterDiagnostic[] = [];
  const commandName = options.commandName.trim();
  if (!commandName) {
    diagnostics.push({ severity: "error", message: "commandName is required." });
  }
  if (!options.helpText.trim()) {
    diagnostics.push({ severity: "error", message: "helpText is required." });
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { diagnostics, files: [] };
  }

  const publisher = slugify(options.publisher ?? "quickdeploy");
  const slug = slugify(commandName);
  const namespace = options.namespace ?? (publisher === "quickdeploy" ? "ai.quickdeploy" : publisher);
  const description = options.description ?? `Use the ${commandName} command-line interface.`;
  const skillRoot = `skills/${publisher}/${slug}`;
  const examples = options.examples ?? [];

  const skillBody = [
    `# ${commandName}`,
    "",
    `Use this skill when a task needs the \`${commandName}\` CLI.`,
    "",
    "## Workflow",
    "",
    "1. Read the reviewed command reference before constructing commands.",
    "2. Prefer read-only or dry-run flags when available.",
    "3. Do not pass raw secrets on the command line.",
    examples.length > 0 ? "\n## Reviewed Examples\n" : "",
    ...examples.map((example) => `- \`${example}\``),
    "",
    "## Reference",
    "",
    "See `references/help.txt` for reviewed CLI help text.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const manifestDraft: CliSkillManifestDraft = {
    apiVersion: "quickdeploy.ai/v1",
    kind: "AgentSkillManifest",
    metadata: {
      name: `${namespace}/${slug}`,
      version: options.version ?? "0.1.0",
      description,
      labels: ["cli", "agent-skills"],
    },
    spec: {
      source: {
        type: "file",
        uri: skillRoot,
      },
      package: {
        entrypoint: "SKILL.md",
        artifacts: {
          references: ["references/help.txt"],
          scripts: [],
          assets: [],
        },
      },
    },
  };

  return {
    diagnostics,
    manifestDraft,
    files: normalizeGeneratedFiles([
      {
        path: `${skillRoot}/SKILL.md`,
        content: renderSkillMarkdown(
          {
            name: slug,
            description,
            metadata: { generatedBy: "cli-2-agent-skills" },
          },
          skillBody,
        ),
      },
      {
        path: `${skillRoot}/references/help.txt`,
        content: options.helpText,
      },
      {
        path: `registry/${publisher}/${slug}.skill.json`,
        content: stableJson(manifestDraft),
      },
    ]),
  };
}
