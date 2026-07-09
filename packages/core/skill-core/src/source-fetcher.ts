import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "./hash.js";

export interface FetchSourceOptions {
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly cwd?: string;
  /** Expected `sha256:<hex>` digest; the fetch fails when the bytes differ. */
  readonly digest?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT = "quickdeploy-skill-core/0.1";

export async function fetchTextSource(
  source: string,
  options: FetchSourceOptions = {},
): Promise<string> {
  const bytes = await fetchBytesSource(source, options);
  return new TextDecoder().decode(bytes);
}

export async function fetchBytesSource(
  source: string,
  options: FetchSourceOptions = {},
): Promise<Uint8Array> {
  const trimmed = source.trim();
  const bytes =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? await fetchHttp(trimmed, options)
      : await readFile(resolveLocalPath(trimmed, options));

  if (options.digest) {
    verifyDigest(bytes, options.digest, source);
  }
  return bytes;
}

function resolveLocalPath(source: string, options: FetchSourceOptions): string {
  if (source.startsWith("file://")) return fileURLToPath(source);
  if (isAbsolute(source)) return source;
  return resolve(options.cwd ?? process.cwd(), source);
}

function verifyDigest(bytes: Uint8Array, digest: string, source: string): void {
  const expected = digest.replace(/^sha256:/, "").toLowerCase();
  const actual = sha256Hex(bytes);
  if (actual !== expected) {
    throw new Error(
      `Digest mismatch for ${source}: expected sha256:${expected}, got sha256:${actual}`,
    );
  }
}

async function fetchHttp(url: string, options: FetchSourceOptions): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
