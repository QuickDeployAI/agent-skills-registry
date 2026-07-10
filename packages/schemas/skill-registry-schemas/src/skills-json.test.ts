import { describe, expect, it } from "vitest";
import {
  QUICKDEPLOY_REGISTRY_CURATION_META_KEY,
  QUICKDEPLOY_REGISTRY_MONETIZATION_META_KEY,
  SkillEntrySchema,
  SkillsJsonEnvelopeSchema,
  quickDeployRegistryMonetization,
} from "./skills-json.js";

describe("SkillsJsonEnvelopeSchema", () => {
  it("accepts an envelope with agents compat entries and rich skill entries", () => {
    const parsed = SkillsJsonEnvelopeSchema.parse({
      $schema: "https://quickdeploy.ai/schemas/skills-json.schema.json",
      agents: [
        {
          skill: "skills/quickdeploy/stripe-payments-operator/SKILL.md",
          summary: "Operate Stripe payments safely.",
        },
      ],
      skills: [
        {
          name: "ai.quickdeploy/stripe-payments-operator",
          version: "0.1.0",
          skillPath: "skills/quickdeploy/stripe-payments-operator",
          contentHash: "a".repeat(64),
          _meta: {
            [QUICKDEPLOY_REGISTRY_CURATION_META_KEY]: {
              verifiedStatus: "review",
              category: "payments",
              isOfficial: true,
              tags: ["manifest-backed", "stripe"],
            },
          },
        },
      ],
    });
    expect(parsed.agents[0]?.skill).toMatch(/SKILL\.md$/);
    expect(parsed.skills[0]?.name).toBe("ai.quickdeploy/stripe-payments-operator");
  });

  it("rejects top-level curation fields on skill entries", () => {
    const result = SkillEntrySchema.safeParse({
      name: "ai.quickdeploy/example",
      skillPath: "skills/quickdeploy/example",
      verifiedStatus: "verified",
    });
    expect(result.success).toBe(false);
  });

  it("accepts monetization payloads under the reverse-DNS meta key", () => {
    const entry = SkillEntrySchema.parse({
      name: "ai.quickdeploy/stripe-payments-operator",
      skillPath: "skills/quickdeploy/stripe-payments-operator",
      _meta: {
        [QUICKDEPLOY_REGISTRY_MONETIZATION_META_KEY]: {
          pricing: { model: "per-request", price: "0.01" },
          acceptedProtocols: ["x402", "l402"],
          x402: {
            networks: ["base"],
            payTo: "0x1111111111111111111111111111111111111111",
          },
        },
      },
    });

    expect(quickDeployRegistryMonetization(entry)).toMatchObject({
      pricing: { model: "per-request", price: "0.01", currency: "USD" },
      acceptedProtocols: ["x402", "l402"],
      x402: {
        networks: ["base"],
        asset: "USDC",
        payTo: "0x1111111111111111111111111111111111111111",
      },
    });
  });

  it("rejects top-level monetization fields on skill entries", () => {
    const result = SkillEntrySchema.safeParse({
      name: "ai.quickdeploy/example",
      skillPath: "skills/quickdeploy/example",
      monetization: { pricing: { model: "per-request", price: "0.01" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects monetization payloads with unknown payment protocols", () => {
    const result = SkillEntrySchema.safeParse({
      name: "ai.quickdeploy/example",
      skillPath: "skills/quickdeploy/example",
      _meta: {
        [QUICKDEPLOY_REGISTRY_MONETIZATION_META_KEY]: {
          pricing: { model: "per-request", price: "0.01" },
          acceptedProtocols: ["visa"],
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid curation payloads under the reverse-DNS meta key", () => {
    const result = SkillEntrySchema.safeParse({
      name: "ai.quickdeploy/example",
      skillPath: "skills/quickdeploy/example",
      _meta: {
        [QUICKDEPLOY_REGISTRY_CURATION_META_KEY]: { verifiedStatus: "not-a-status" },
      },
    });
    expect(result.success).toBe(false);
  });
});
