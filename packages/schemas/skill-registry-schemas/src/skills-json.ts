import { z } from "zod";
import { EXACT_VERSION_PATTERN } from "./skill-manifest.js";

export const SKILLS_JSON_SCHEMA_URI = "https://quickdeploy.ai/schemas/skills-json.schema.json";

export const QUICKDEPLOY_REGISTRY_META_PREFIX = "ai.quickdeploy.registry/";
export const QUICKDEPLOY_REGISTRY_CURATION_META_KEY = "ai.quickdeploy.registry/curation";
export const QUICKDEPLOY_REGISTRY_SAFETY_META_KEY = "ai.quickdeploy.registry/safety";
export const QUICKDEPLOY_REGISTRY_MANIFEST_META_KEY = "ai.quickdeploy.registry/manifest";

export const QuickDeployRegistryCurationSchema = z.object({
  verifiedStatus: z
    .enum(["unverified", "verified", "review", "deprecated", "blocked"])
    .default("unverified"),
  category: z.string().min(1).optional(),
  isOfficial: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  tags: z.array(z.string().min(1)).default([]),
});
export type QuickDeployRegistryCuration = z.infer<typeof QuickDeployRegistryCurationSchema>;

export const QuickDeployRegistrySafetySchema = z.object({
  readOnly: z.boolean(),
  destructiveCount: z.number().int().min(0),
  sandboxDefault: z.enum(["sandbox", "production"]).optional(),
});
export type QuickDeployRegistrySafety = z.infer<typeof QuickDeployRegistrySafetySchema>;

const QUICKDEPLOY_TOP_LEVEL_FIELDS = new Set([
  "verifiedStatus",
  "verified_status",
  "category",
  "isOfficial",
  "is_official",
  "isPaid",
  "is_paid",
  "tags",
  "quickdeploy",
  "quickDeploy",
  "curation",
  "manifest",
]);

export const SkillEntryMetaSchema = z.record(z.string(), z.unknown()).superRefine((meta, ctx) => {
  const curation = meta[QUICKDEPLOY_REGISTRY_CURATION_META_KEY];
  if (curation !== undefined) {
    const parsed = QuickDeployRegistryCurationSchema.safeParse(curation);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          ...issue,
          path: [QUICKDEPLOY_REGISTRY_CURATION_META_KEY, ...issue.path],
        });
      }
    }
  }
  const safety = meta[QUICKDEPLOY_REGISTRY_SAFETY_META_KEY];
  if (safety !== undefined) {
    const parsed = QuickDeployRegistrySafetySchema.safeParse(safety);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          ...issue,
          path: [QUICKDEPLOY_REGISTRY_SAFETY_META_KEY, ...issue.path],
        });
      }
    }
  }
});
export type SkillEntryMeta = z.infer<typeof SkillEntryMetaSchema>;

/**
 * Compatibility index entry consumed verbatim by MCP-Registry's
 * agent-skills-2-mcp registry-index loader: `skill` is a repository-relative
 * path to the skill's SKILL.md.
 */
export const AgentIndexEntrySchema = z.object({
  skill: z.string().min(1),
  summary: z.string().min(1).optional(),
});
export type AgentIndexEntry = z.infer<typeof AgentIndexEntrySchema>;

export const SkillEntrySchema = z
  .object({
    name: z
      .string()
      .min(3)
      .regex(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/),
    version: z.string().regex(EXACT_VERSION_PATTERN).optional(),
    description: z.string().optional(),
    skillPath: z.string().min(1),
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    labels: z.array(z.string().min(1)).optional(),
    _meta: SkillEntryMetaSchema.optional(),
  })
  .catchall(z.unknown())
  .superRefine((entry, ctx) => {
    for (const key of Object.keys(entry)) {
      if (QUICKDEPLOY_TOP_LEVEL_FIELDS.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "QuickDeploy registry curation belongs under reverse-DNS _meta keys.",
        });
      }
    }
  });
export type SkillEntry = z.infer<typeof SkillEntrySchema>;

export const SkillsJsonEnvelopeSchema = z.object({
  $schema: z.string().optional(),
  generatedAt: z.string().optional(),
  agents: z.array(AgentIndexEntrySchema).default([]),
  skills: z.array(SkillEntrySchema).default([]),
  _meta: z.record(z.string(), z.unknown()).optional(),
});
export type SkillsJsonEnvelope = z.infer<typeof SkillsJsonEnvelopeSchema>;

export function quickDeployRegistryCuration(entry: SkillEntry): QuickDeployRegistryCuration | null {
  const curation = entry._meta?.[QUICKDEPLOY_REGISTRY_CURATION_META_KEY];
  if (curation === undefined) return null;
  return QuickDeployRegistryCurationSchema.parse(curation);
}
