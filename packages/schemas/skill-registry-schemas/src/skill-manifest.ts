import { z } from "zod";

export const SKILL_MANIFEST_API_VERSION = "quickdeploy.ai/v1";
export const SKILL_MANIFEST_KIND = "SkillManifest";

export const QUICKDEPLOY_SKILL_NAME_PREFIX = "ai.quickdeploy/";

export const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
export const ENV_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
export const SKILL_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
export const IMPORTER_ENGINE_PATTERN = /^[a-z0-9][a-z0-9-]*-2-agent-skills$/;
export const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
export const OUTPUT_PATH_PATTERN = /^skills\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;

/**
 * Frontmatter `metadata` keys that mirror `spec.safety` as plain strings, so
 * safety survives in the SKILL.md content alone (the frontmatter metadata
 * contract is a string→string map). skills-cli validate enforces that these
 * mirrors agree with the manifest's structured safety block.
 */
export const SKILL_SAFETY_READ_ONLY_META_KEY = "ai.quickdeploy.skills/read-only";
export const SKILL_SAFETY_SANDBOX_DEFAULT_META_KEY = "ai.quickdeploy.skills/sandbox-default";
export const SKILL_SAFETY_DESTRUCTIVE_OPS_META_KEY = "ai.quickdeploy.skills/destructive-ops";

const skillRelativePath = z
  .string()
  .min(1)
  .regex(/^(scripts|references|assets)\//, {
    message: "Skill-relative paths must live under scripts/, references/, or assets/.",
  })
  .refine((value) => !value.includes("..") && !value.startsWith("/"), {
    message: "Skill-relative paths must not escape the skill directory.",
  });

export const SkillManifestMetadataSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(200)
    .regex(/^ai\.quickdeploy\/[a-zA-Z0-9._-]+$/),
  version: z.string().regex(EXACT_VERSION_PATTERN),
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(100).optional(),
  labels: z.array(z.string().min(1)).default([]),
});
export type SkillManifestMetadata = z.infer<typeof SkillManifestMetadataSchema>;

export const SkillManifestImporterSchema = z.object({
  engine: z.string().regex(IMPORTER_ENGINE_PATTERN),
  versionRange: z.string().min(1),
});
export type SkillManifestImporter = z.infer<typeof SkillManifestImporterSchema>;

export const SkillManifestSourceSchema = z.object({
  type: z.enum(["http", "file", "git"]),
  uri: z.string().min(1),
  digest: z.string().regex(SHA256_DIGEST_PATTERN).optional(),
  ref: z.string().min(1).optional(),
});
export type SkillManifestSource = z.infer<typeof SkillManifestSourceSchema>;

export const SkillManifestSelectSchema = z
  .object({
    commands: z
      .array(
        z.object({
          command: z.string().min(1),
          destructive: z.boolean().default(false),
        }),
      )
      .optional(),
    requests: z
      .array(
        z.object({
          method: z.enum(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]),
          uriTemplate: z.string().min(1),
        }),
      )
      .optional(),
    docGlobs: z.array(z.string().min(1)).optional(),
  })
  .refine((select) => Object.values(select).some((value) => value !== undefined), {
    message: "select must declare at least one of commands, requests, or docGlobs.",
  });
export type SkillManifestSelect = z.infer<typeof SkillManifestSelectSchema>;

/**
 * The SKILL.md frontmatter contract. This must stay byte-compatible with the
 * `SkillFrontmatter` interface in MCP-Registry's agent-skills-2-mcp importer
 * and with `inferAgentSkill()` in the monorepo registry-schemas package:
 * required `name` + `description`; optional `license`, `compatibility`,
 * `allowed-tools`, and a string-valued `metadata` map.
 */
export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1).max(100).regex(SKILL_SLUG_PATTERN),
  description: z.string().min(1).max(1024),
  license: z.string().min(1).optional(),
  compatibility: z.string().min(1).optional(),
  "allowed-tools": z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export const SkillDestructiveOperationSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  confirmation: z.literal("explicit"),
});
export type SkillDestructiveOperation = z.infer<typeof SkillDestructiveOperationSchema>;

export const SkillSafetySchema = z
  .object({
    readOnly: z.boolean(),
    destructiveOperations: z.array(SkillDestructiveOperationSchema).default([]),
    sandbox: z.object({
      supported: z.boolean(),
      defaultMode: z.enum(["sandbox", "production"]),
      switchEnvVar: z.string().regex(ENV_NAME_PATTERN).optional(),
    }),
    secretsPolicy: z.literal("env-names-only").default("env-names-only"),
  })
  .refine((safety) => safety.readOnly || safety.destructiveOperations.length > 0, {
    message: "read-write skills must enumerate at least one destructive operation.",
  });
export type SkillSafety = z.infer<typeof SkillSafetySchema>;

export const SkillRequirementsSchema = z.object({
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.enum(["cli", "mcp"]),
        versionRange: z.string().min(1).optional(),
        installHint: z.string().min(1).optional(),
      }),
    )
    .default([]),
  env: z
    .array(
      z.object({
        name: z.string().regex(ENV_NAME_PATTERN, {
          message:
            "Environment entries must reference variables by SCREAMING_SNAKE_CASE name only — never secret values.",
        }),
        description: z.string().min(1).optional(),
        required: z.boolean().default(false),
        secret: z.boolean().default(false),
      }),
    )
    .default([]),
});
export type SkillRequirements = z.infer<typeof SkillRequirementsSchema>;

export const SkillManifestSpecSchema = z
  .object({
    importer: SkillManifestImporterSchema.optional(),
    source: SkillManifestSourceSchema,
    select: SkillManifestSelectSchema.optional(),
    config: z
      .object({
        schema: z.record(z.string(), z.unknown()).optional(),
        defaults: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
    skill: SkillFrontmatterSchema,
    safety: SkillSafetySchema,
    requirements: SkillRequirementsSchema.optional(),
    references: z
      .array(
        z.object({
          path: skillRelativePath,
          title: z.string().min(1).optional(),
          purpose: z.string().min(1).optional(),
        }),
      )
      .default([]),
    scripts: z
      .array(
        z.object({
          path: skillRelativePath,
          allowlistedByDefault: z.literal(false),
          purpose: z.string().min(1).optional(),
        }),
      )
      .default([]),
    output: z.object({
      path: z.string().regex(OUTPUT_PATH_PATTERN, {
        message: 'output.path must match "skills/<provider>/<skill-name>".',
      }),
    }),
  })
  .superRefine((spec, ctx) => {
    if ((spec.source.type === "http" || spec.source.type === "git") && !spec.source.digest) {
      ctx.addIssue({
        code: "custom",
        path: ["source", "digest"],
        message: "http and git sources must be digest-pinned (sha256:<hex>).",
      });
    }
  });
export type SkillManifestSpec = z.infer<typeof SkillManifestSpecSchema>;

export const SkillManifestSchema = z.object({
  apiVersion: z.literal(SKILL_MANIFEST_API_VERSION),
  kind: z.literal(SKILL_MANIFEST_KIND),
  metadata: SkillManifestMetadataSchema,
  spec: SkillManifestSpecSchema,
  _meta: z.record(z.string(), z.unknown()).optional(),
});
export type SkillManifest = z.infer<typeof SkillManifestSchema>;

/**
 * Per-importer `spec.config.defaults` JSON-Schema registry, mirroring
 * IMPORTER_CONFIG_SCHEMAS in MCP-Registry's registry-schemas package. Engines
 * land here as their importer packages are built (see docs/backlog).
 */
export const SKILL_IMPORTER_CONFIG_SCHEMAS: Record<string, Record<string, unknown>> = {
  "cli-2-agent-skills": {
    type: "object",
    additionalProperties: false,
    properties: {
      binary: { type: "string", description: "CLI binary name the generated skill drives." },
      helpCommand: { type: "string", description: "Command used to enumerate CLI help output." },
      mode: { type: "string", enum: ["sandbox", "production"] },
    },
  },
  "openapi-2-agent-skills": {
    type: "object",
    additionalProperties: false,
    properties: {
      baseUrl: { type: "string", format: "uri" },
      requestTimeoutMs: { type: "number", minimum: 1 },
      mode: { type: "string", enum: ["read-only", "read-write"] },
    },
  },
};

export function getSkillImporterConfigSchema(engine: string): Record<string, unknown> | null {
  return SKILL_IMPORTER_CONFIG_SCHEMAS[engine] ?? null;
}
