import { z } from "zod";
import { EXACT_VERSION_PATTERN, SKILL_SLUG_PATTERN } from "./skill-manifest.js";

export const SKILLSET_API_VERSION = "quickdeploy.ai/v1";
export const SKILLSET_KIND = "SkillSet";

/**
 * A pinned external skill, aligned with the monorepo skills-lock.json entry
 * format: `computedHash` is the SHA-256 (hex) of the file at `skillPath`.
 */
export const PinnedSkillSchema = z.object({
  name: z.string().min(1).regex(SKILL_SLUG_PATTERN),
  source: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  sourceType: z.literal("github"),
  ref: z.string().min(1).optional(),
  skillPath: z.string().min(1).regex(/SKILL\.md$/),
  computedHash: z.string().regex(/^[a-f0-9]{64}$/),
  summary: z.string().min(1).optional(),
});
export type PinnedSkill = z.infer<typeof PinnedSkillSchema>;

export const SkillSetSchema = z.object({
  apiVersion: z.literal(SKILLSET_API_VERSION),
  kind: z.literal(SKILLSET_KIND),
  metadata: z.object({
    name: z
      .string()
      .min(3)
      .max(200)
      .regex(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/),
    version: z.string().regex(EXACT_VERSION_PATTERN),
    title: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(100).optional(),
    labels: z.array(z.string().min(1)).default([]),
  }),
  spec: z.object({
    skills: z.array(PinnedSkillSchema).min(1),
  }),
  _meta: z.record(z.string(), z.unknown()).optional(),
});
export type SkillSet = z.infer<typeof SkillSetSchema>;
