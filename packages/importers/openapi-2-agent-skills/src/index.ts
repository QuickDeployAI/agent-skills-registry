import { renderSkillMarkdown, slugify, stableJson } from "@quickdeployai/agent-skill-core";
import {
  normalizeGeneratedFiles,
  type AgentSkillImporterResult,
  type ImporterDiagnostic,
} from "@quickdeployai/agent-skill-importer-core";

type OpenApiDocument = {
  openapi?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: Array<{ url?: string }>;
  paths?: Record<string, Record<string, OpenApiOperation | unknown>>;
};

type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
};

export interface OpenApiToAgentSkillsOptions {
  document: OpenApiDocument;
  name?: string;
  description?: string;
  namespace?: string;
  publisher?: string;
  version?: string;
  baseUrl?: string;
  includeDeprecated?: boolean;
}

export interface OpenApiSkillManifestDraft {
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

interface OperationSummary {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

export function openApiToAgentSkill(
  options: OpenApiToAgentSkillsOptions,
): AgentSkillImporterResult<OpenApiSkillManifestDraft> {
  const diagnostics: ImporterDiagnostic[] = [];
  const title = options.name ?? options.document.info?.title ?? "OpenAPI API";
  const description =
    options.description ??
    options.document.info?.description ??
    `Use the ${title} API from its reviewed OpenAPI contract.`;
  const publisher = slugify(options.publisher ?? "quickdeploy");
  const slug = slugify(title);
  const namespace = options.namespace ?? (publisher === "quickdeploy" ? "ai.quickdeploy" : publisher);
  const skillRoot = `skills/${publisher}/${slug}`;
  const version = options.version ?? normalizeVersion(options.document.info?.version);
  const operations = collectOperations(options.document, Boolean(options.includeDeprecated));

  if (!options.document.openapi) {
    diagnostics.push({ severity: "warning", message: "Document does not declare an openapi version." });
  }
  if (operations.length === 0) {
    diagnostics.push({ severity: "warning", message: "No non-deprecated operations were found." });
  }

  const baseUrl = options.baseUrl ?? options.document.servers?.find((server) => server.url)?.url;
  const operationReference = renderOperationReference(operations);
  const skillBody = [
    `# ${title}`,
    "",
    `Use this skill when a task needs the ${title} API.`,
    baseUrl ? `\nDefault base URL: \`${baseUrl}\`.` : "",
    "",
    "## Workflow",
    "",
    "1. Identify the reviewed operation in `references/operations.md`.",
    "2. Confirm authentication and required parameters before making a request.",
    "3. Prefer read-only operations unless the user explicitly asks for a mutation.",
    "4. Never place raw secrets in prompts, logs, or generated files.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const manifestDraft: OpenApiSkillManifestDraft = {
    apiVersion: "quickdeploy.ai/v1",
    kind: "AgentSkillManifest",
    metadata: {
      name: `${namespace}/${slug}`,
      version,
      description,
      labels: ["openapi", "api", "agent-skills"],
    },
    spec: {
      source: {
        type: "file",
        uri: skillRoot,
      },
      package: {
        entrypoint: "SKILL.md",
        artifacts: {
          references: ["references/operations.md", "references/openapi.json"],
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
            metadata: { generatedBy: "openapi-2-agent-skills" },
          },
          skillBody,
        ),
      },
      {
        path: `${skillRoot}/references/operations.md`,
        content: operationReference,
      },
      {
        path: `${skillRoot}/references/openapi.json`,
        content: stableJson(options.document),
      },
      {
        path: `registry/${publisher}/${slug}.skill.json`,
        content: stableJson(manifestDraft),
      },
    ]),
  };
}

function collectOperations(doc: OpenApiDocument, includeDeprecated: boolean): OperationSummary[] {
  const operations: OperationSummary[] = [];
  for (const [pathName, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, maybeOperation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      const operation = maybeOperation as OpenApiOperation;
      if (operation.deprecated && !includeDeprecated) continue;
      operations.push({
        method: method.toUpperCase(),
        path: pathName,
        ...(operation.operationId ? { operationId: operation.operationId } : {}),
        ...(operation.summary ?? operation.description
          ? { summary: operation.summary ?? operation.description }
          : {}),
      });
    }
  }
  return operations.sort((left, right) => `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`));
}

function renderOperationReference(operations: readonly OperationSummary[]): string {
  const lines = ["# Reviewed OpenAPI Operations", ""];
  for (const operation of operations) {
    lines.push(`## ${operation.method} ${operation.path}`, "");
    if (operation.operationId) lines.push(`Operation ID: \`${operation.operationId}\``, "");
    if (operation.summary) lines.push(operation.summary, "");
  }
  if (operations.length === 0) {
    lines.push("No reviewed operations were extracted.", "");
  }
  return lines.join("\n");
}

function normalizeVersion(version: string | undefined): string {
  return version && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : "0.1.0";
}
