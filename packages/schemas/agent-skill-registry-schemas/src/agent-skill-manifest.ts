import { z } from "zod";

export const AGENT_SKILL_MANIFEST_API_VERSION = "quickdeploy.ai/v1" as const;
export const AGENT_SKILL_MANIFEST_KIND = "AgentSkillManifest" as const;
export const AGENT_SKILL_MANIFEST_SCHEMA_ID =
  "https://schemas.quickdeploy.ai/agent-skill-manifest.v1.schema.json" as const;
export const QUICKDEPLOY_AGENT_SKILL_MANIFEST_META_KEY =
  "ai.quickdeploy.agent-skills/manifest" as const;

const EXACT_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const SAFE_RELATIVE_PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[^\0]+$/;

export function isSafeRelativePath(value: string): boolean {
  return SAFE_RELATIVE_PATH_PATTERN.test(value);
}

export const ExactVersionSchema = z
  .string()
  .regex(EXACT_VERSION_PATTERN, "version must be exact semver, not a range");

export const AgentSkillNameSchema = z
  .string()
  .min(3)
  .max(200)
  .regex(
    /^[a-zA-Z0-9.-]+\/[a-z0-9][a-z0-9._-]*$/,
    'name must match "<namespace>/<slug>" using a lowercase skill slug',
  );

export const SafeRelativePathSchema = z
  .string()
  .min(1)
  .refine(isSafeRelativePath, "path must be safe and relative");

const SourceUriSchema = z
  .string()
  .min(1)
  .regex(
    /^(https?:\/\/|file:\/\/|git\+https:\/\/|git\+ssh:\/\/|ssh:\/\/|oci:\/\/|[A-Za-z0-9._/-]+)[^\s]*$/,
    "source uri must be http(s), file, git+https, git+ssh, ssh, oci, or a relative path",
  );

export const AgentSkillManifestMetadataSchema = z
  .object({
    name: AgentSkillNameSchema,
    version: ExactVersionSchema,
    title: z.string().min(1).max(120).optional(),
    description: z.string().min(1).max(240),
    labels: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type AgentSkillManifestMetadata = z.infer<typeof AgentSkillManifestMetadataSchema>;

export const AgentSkillSourceSchema = z
  .object({
    type: z.enum(["file", "git", "http", "oci"]),
    uri: SourceUriSchema,
    ref: z.string().min(1).optional(),
    digest: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
  })
  .strict();
export type AgentSkillSource = z.infer<typeof AgentSkillSourceSchema>;

export const AgentSkillArtifactsSchema = z
  .object({
    scripts: z.array(SafeRelativePathSchema).default([]),
    references: z.array(SafeRelativePathSchema).default([]),
    assets: z.array(SafeRelativePathSchema).default([]),
  })
  .strict();
export type AgentSkillArtifacts = z.infer<typeof AgentSkillArtifactsSchema>;

export const AgentSkillPackageSchema = z
  .object({
    entrypoint: SafeRelativePathSchema.default("SKILL.md"),
    artifacts: AgentSkillArtifactsSchema.default({ scripts: [], references: [], assets: [] }),
  })
  .strict();
export type AgentSkillPackage = z.infer<typeof AgentSkillPackageSchema>;

export const AgentSkillCompatibilitySchema = z
  .object({
    agents: z.array(z.string().min(1)).default([]),
    models: z.array(z.string().min(1)).default([]),
    tools: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type AgentSkillCompatibility = z.infer<typeof AgentSkillCompatibilitySchema>;

export const AgentSkillSafetySchema = z
  .object({
    status: z.enum(["experimental", "review", "trusted", "deprecated", "blocked"]).default("review"),
    permissions: z.array(z.string().min(1)).default([]),
    secrets: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type AgentSkillSafety = z.infer<typeof AgentSkillSafetySchema>;

export const AgentSkillCurationSchema = z
  .object({
    verifiedStatus: z
      .enum(["unverified", "review", "verified", "deprecated", "blocked"])
      .default("unverified"),
    category: z.string().min(1).optional(),
    isOfficial: z.boolean().optional(),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type AgentSkillCuration = z.infer<typeof AgentSkillCurationSchema>;

export const AgentSkillManifestSpecSchema = z
  .object({
    source: AgentSkillSourceSchema,
    package: AgentSkillPackageSchema.default({
      entrypoint: "SKILL.md",
      artifacts: { scripts: [], references: [], assets: [] },
    }),
    compatibility: AgentSkillCompatibilitySchema.default({ agents: [], models: [], tools: [] }),
    safety: AgentSkillSafetySchema.default({ status: "review", permissions: [], secrets: [] }),
    curation: AgentSkillCurationSchema.default({ verifiedStatus: "unverified", tags: [] }),
  })
  .strict();
export type AgentSkillManifestSpec = z.infer<typeof AgentSkillManifestSpecSchema>;

export const AgentSkillManifestSchema = z
  .object({
    apiVersion: z.literal(AGENT_SKILL_MANIFEST_API_VERSION),
    kind: z.literal(AGENT_SKILL_MANIFEST_KIND),
    metadata: AgentSkillManifestMetadataSchema,
    spec: AgentSkillManifestSpecSchema,
  })
  .strict();
export type AgentSkillManifest = z.infer<typeof AgentSkillManifestSchema>;

export function skillSlugFromName(name: string): string {
  return name.slice(name.indexOf("/") + 1);
}
