import path from "node:path";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("\0") || value.includes("\\")) return false;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  return !value.split("/").some((part) => part === "..");
}

export function assertSafeRelativePath(value: string): string {
  if (!isSafeRelativePath(value)) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return value;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function skillSlugFromRegistryName(name: string): string {
  const separator = name.indexOf("/");
  return separator === -1 ? slugify(name) : slugify(name.slice(separator + 1));
}
