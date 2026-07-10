import { z } from "zod";
import {
  AgentSkillArtifactsSchema,
  AgentSkillCompatibilitySchema,
  AgentSkillCurationSchema,
  AgentSkillManifestSchema,
  AgentSkillNameSchema,
  AgentSkillPackageSchema,
  AgentSkillSafetySchema,
  AgentSkillSourceSchema,
  ExactVersionSchema,
  QUICKDEPLOY_AGENT_SKILL_MANIFEST_META_KEY,
  SafeRelativePathSchema,
} from "./agent-skill-manifest";

export const AGENT_SKILLS_JSON_SCHEMA_ID =
  "https://schemas.quickdeploy.ai/agent-skills-json.v1.schema.json" as const;
export const QUICKDEPLOY_AGENT_SKILL_CURATION_META_KEY =
  "ai.quickdeploy.agent-skills/curation" as const;

export const AgentSkillsCatalogEntrySchema = z
  .object({
    id: AgentSkillNameSchema,
    name: z.string().min(1),
    title: z.string().min(1).optional(),
    version: ExactVersionSchema,
    description: z.string().min(1),
    labels: z.array(z.string().min(1)).default([]),
    skill: SafeRelativePathSchema,
    source: AgentSkillSourceSchema,
    package: AgentSkillPackageSchema,
    artifacts: AgentSkillArtifactsSchema,
    compatibility: AgentSkillCompatibilitySchema,
    safety: AgentSkillSafetySchema,
    curation: AgentSkillCurationSchema,
    _meta: z
      .record(z.string(), z.unknown())
      .default({})
      .superRefine((meta, ctx) => {
        const manifest = meta[QUICKDEPLOY_AGENT_SKILL_MANIFEST_META_KEY];
        if (manifest !== undefined) {
          const parsed = AgentSkillManifestSchema.safeParse(manifest);
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              ctx.addIssue({
                ...issue,
                path: [QUICKDEPLOY_AGENT_SKILL_MANIFEST_META_KEY, ...issue.path],
              });
            }
          }
        }
      }),
  })
  .strict();
export type AgentSkillsCatalogEntry = z.infer<typeof AgentSkillsCatalogEntrySchema>;

export const AgentSkillsJsonEnvelopeSchema = z
  .object({
    $schema: z.string().optional(),
    skills: z.array(AgentSkillsCatalogEntrySchema).default([]),
    _meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((envelope, ctx) => {
    const seen = new Map<string, number>();
    for (const [index, skill] of envelope.skills.entries()) {
      const firstIndex = seen.get(skill.id);
      if (firstIndex !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["skills", index, "id"],
          message: `duplicate skill id "${skill.id}" also appears at skills[${firstIndex}]`,
        });
      } else {
        seen.set(skill.id, index);
      }
    }
  });
export type AgentSkillsJsonEnvelope = z.infer<typeof AgentSkillsJsonEnvelopeSchema>;
