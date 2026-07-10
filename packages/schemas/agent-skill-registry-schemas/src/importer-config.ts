export type JsonSchemaLike = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type ImporterConfigJsonSchema = {
  $id: string;
  $schema: "https://json-schema.org/draft/2020-12/schema";
  title: string;
  type: "object";
  additionalProperties: boolean;
  properties: Record<string, JsonSchemaLike>;
  required?: string[];
};

export const CLI_2_AGENT_SKILLS_CONFIG_SCHEMA = {
  $id: "https://schemas.quickdeploy.ai/importers/cli-2-agent-skills.config.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "cli-2-agent-skills importer config",
  type: "object",
  additionalProperties: false,
  properties: {
    commandName: {
      type: "string",
      description: "Command name the generated skill teaches.",
    },
    helpTextPath: {
      type: "string",
      description: "Path to reviewed CLI help or manpage text.",
    },
    examples: {
      type: "array",
      description: "Reviewed example invocations to include in the skill.",
      items: { type: "string" },
    },
  },
  required: ["commandName", "helpTextPath"],
} as const satisfies ImporterConfigJsonSchema;

export const OPENAPI_2_AGENT_SKILLS_CONFIG_SCHEMA = {
  $id: "https://schemas.quickdeploy.ai/importers/openapi-2-agent-skills.config.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "openapi-2-agent-skills importer config",
  type: "object",
  additionalProperties: false,
  properties: {
    documentPath: {
      type: "string",
      description: "Path to the reviewed OpenAPI document.",
    },
    baseUrl: {
      type: "string",
      format: "uri",
      description: "Optional deployment base URL to mention in generated instructions.",
    },
    includeDeprecated: {
      type: "boolean",
      description: "Whether deprecated operations should be included in references.",
    },
  },
  required: ["documentPath"],
} as const satisfies ImporterConfigJsonSchema;

const IMPORTER_CONFIG_SCHEMAS: Record<string, ImporterConfigJsonSchema> = {
  "cli-2-agent-skills": CLI_2_AGENT_SKILLS_CONFIG_SCHEMA,
  "openapi-2-agent-skills": OPENAPI_2_AGENT_SKILLS_CONFIG_SCHEMA,
};

export function getImporterConfigSchema(engine: string): ImporterConfigJsonSchema | undefined {
  return IMPORTER_CONFIG_SCHEMAS[engine];
}
