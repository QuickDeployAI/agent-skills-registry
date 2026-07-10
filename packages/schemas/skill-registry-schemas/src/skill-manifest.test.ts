import { describe, expect, it } from "vitest";
import {
  getSkillImporterConfigSchema,
  SKILL_IMPORTER_CONFIG_SCHEMAS,
  SkillManifestSchema,
} from "./skill-manifest.js";

const validManifest = {
  apiVersion: "quickdeploy.ai/v1",
  kind: "SkillManifest",
  metadata: {
    name: "ai.quickdeploy/stripe-payments-operator",
    version: "0.1.0",
    title: "Stripe Payments Operator",
    description: "Operate Stripe payments safely from an agent.",
    labels: ["payments", "stripe", "smb"],
  },
  spec: {
    source: {
      type: "file",
      uri: "skills/quickdeploy/stripe-payments-operator",
    },
    skill: {
      name: "stripe-payments-operator",
      description: "Inspect Stripe payments, customers, and subscriptions with sandbox-safe defaults.",
      metadata: {
        "ai.quickdeploy.skills/read-only": "false",
        "ai.quickdeploy.skills/sandbox-default": "sandbox",
      },
    },
    safety: {
      readOnly: false,
      destructiveOperations: [
        {
          name: "refund-payment",
          description: "Issues a refund against a captured payment.",
          confirmation: "explicit",
        },
      ],
      sandbox: {
        supported: true,
        defaultMode: "sandbox",
        switchEnvVar: "STRIPE_LIVE_MODE",
      },
    },
    requirements: {
      tools: [{ name: "stripe", kind: "cli", installHint: "https://docs.stripe.com/stripe-cli" }],
      env: [{ name: "STRIPE_API_KEY", required: true, secret: true }],
    },
    references: [{ path: "references/stripe-cli.md", title: "Stripe CLI reference" }],
    output: { path: "skills/quickdeploy/stripe-payments-operator" },
  },
};

describe("SkillManifestSchema", () => {
  it("accepts a valid hand-authored manifest", () => {
    const parsed = SkillManifestSchema.parse(validManifest);
    expect(parsed.metadata.name).toBe("ai.quickdeploy/stripe-payments-operator");
    expect(parsed.spec.safety.secretsPolicy).toBe("env-names-only");
  });

  it("rejects names outside the ai.quickdeploy namespace", () => {
    const manifest = structuredClone(validManifest);
    manifest.metadata.name = "com.example/foreign-skill";
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects version ranges", () => {
    const manifest = structuredClone(validManifest);
    manifest.metadata.version = "^0.1.0";
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("requires a digest for http and git sources", () => {
    const manifest = structuredClone(validManifest);
    manifest.spec.source = { type: "http", uri: "https://example.com/openapi.json" };
    const result = SkillManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);

    manifest.spec.source = {
      type: "http",
      uri: "https://example.com/openapi.json",
      digest: `sha256:${"a".repeat(64)}`,
    } as typeof manifest.spec.source;
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("requires destructive operations when a skill is not read-only", () => {
    const manifest = structuredClone(validManifest);
    manifest.spec.safety.destructiveOperations = [];
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);

    manifest.spec.safety.readOnly = true;
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(true);
  });

  it("rejects env requirement entries that are not variable names", () => {
    const manifest = structuredClone(validManifest);
    manifest.spec.requirements!.env = [
      { name: "sk_live_abc123", required: true, secret: true } as never,
    ];
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects reference paths that escape the skill directory", () => {
    const manifest = structuredClone(validManifest);
    manifest.spec.references = [
      { path: "references/../../etc/passwd" } as (typeof manifest.spec.references)[number],
    ];
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects output paths outside skills/<provider>/<name>", () => {
    const manifest = structuredClone(validManifest);
    manifest.spec.output.path = "packages/evil";
    expect(SkillManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("exposes per-importer config schemas", () => {
    expect(getSkillImporterConfigSchema("cli-2-agent-skills")).toBe(
      SKILL_IMPORTER_CONFIG_SCHEMAS["cli-2-agent-skills"],
    );
    expect(getSkillImporterConfigSchema("unknown-2-agent-skills")).toBeNull();
  });
});
