export function workspacePackageKinds(): readonly string[] {
  return ["core", "importers", "schemas", "tools"] as const;
}
