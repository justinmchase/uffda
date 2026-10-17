import * as cp from "node:child_process";
import * as path from "node:path";
import { MIN_UFFDA_VERSION, satisfiesMinVersion } from "./version";
import { downloadUffdaBinary } from "./download";

/** A resolved command to launch either `uffda lsp` or `uffda mcp`. */
export interface ResolvedServer {
  command: string;
  args: string[];
  /** Human-readable description of how the command was resolved, for logs/errors. */
  source: "override" | "path" | "download";
}

export class ResolveServerError extends Error {}

export interface ResolveOptions {
  /** Explicit override for the executable (`uffda.lsp.serverPath`). Bypasses PATH and download entirely. */
  serverPathOverride?: string;
  /** Args to use instead of the default single subcommand arg, only meaningful with an override. */
  serverArgsOverride?: string[];
  /** Default subcommand to run when no override is set (e.g. "lsp" or "mcp"). */
  defaultArgs: string[];
  /** Directory to cache a downloaded binary in (persistent extension storage). */
  storageDir: string;
  /**
   * Workspace folder used to resolve relative overrides such as
   * `rust/target/release/uffda`. Bare names (`uffdar`) stay on PATH.
   */
  workspaceFolder?: string;
  minVersion?: string;
}

/**
 * Resolves the command used to launch `uffda`/`uffdar`, per requirement
 * cli-language-server-007: an explicit override always wins (no
 * PATH/version/download checks); otherwise prefer a PATH binary whose
 * version satisfies the minimum; otherwise download and cache the
 * platform-matching release binary.
 *
 * Overrides:
 * - bare name (`uffdar`, `uffda`) → used as a PATH command
 * - absolute path → used verbatim
 * - relative path (`rust/target/release/uffda`) → resolved against
 *   `workspaceFolder` when provided
 */
export async function resolveUffdaServer(opts: ResolveOptions): Promise<ResolvedServer> {
  if (opts.serverPathOverride) {
    return {
      command: resolveOverrideCommand(opts.serverPathOverride, opts.workspaceFolder),
      args: opts.serverArgsOverride && opts.serverArgsOverride.length > 0
        ? opts.serverArgsOverride
        : opts.defaultArgs,
      source: "override",
    };
  }

  const minVersion = opts.minVersion ?? MIN_UFFDA_VERSION;
  // Prefer the Rust preview (`uffdar`) when present, then Deno `uffda`.
  const pathBinary = await tryGetPathBinary(minVersion);
  if (pathBinary) {
    return {
      command: pathBinary.command,
      args: opts.defaultArgs,
      source: "path",
    };
  }

  try {
    const binaryPath = await downloadUffdaBinary(opts.storageDir);
    const downloadedVersion = await tryGetVersion(binaryPath);
    if (!downloadedVersion || !satisfiesMinVersion(downloadedVersion, minVersion)) {
      throw new ResolveServerError(
        `Downloaded uffda binary reports version ${
          downloadedVersion ?? "unknown"
        }, which does not satisfy the minimum required version ${minVersion}. ` +
          `The latest published release may lag behind this extension's requirement; ` +
          `install a compatible uffdar/uffda on PATH or set uffda.lsp.serverPath to a built binary.`,
      );
    }
    return { command: binaryPath, args: opts.defaultArgs, source: "download" };
  } catch (err) {
    if (err instanceof ResolveServerError) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    throw new ResolveServerError(
      `No compatible uffdar/uffda binary was found on PATH. Automatic download also failed: ${reason}`,
    );
  }
}

/**
 * Turn a `uffda.lsp.serverPath` override into a process command.
 * Bare command names stay on PATH; relative paths resolve against the
 * uffda workspace folder so a local build can be selected without install.
 */
export function resolveOverrideCommand(
  override: string,
  workspaceFolder?: string,
): string {
  const trimmed = override.trim();
  if (!trimmed) return trimmed;
  if (path.isAbsolute(trimmed)) return trimmed;
  // Bare executable name (uffdar / uffda / deno) — leave for PATH lookup.
  if (!trimmed.includes("/") && !trimmed.includes("\\")) return trimmed;
  if (workspaceFolder) return path.resolve(workspaceFolder, trimmed);
  return path.resolve(trimmed);
}

/** Prefer `uffdar` (Rust) over `uffda` (Deno) when both satisfy the minimum. */
async function tryGetPathBinary(
  minVersion: string,
): Promise<{ command: string; version: string } | undefined> {
  for (const command of ["uffdar", "uffda"]) {
    const version = await tryGetVersion(command);
    if (version && satisfiesMinVersion(version, minVersion)) {
      return { command, version };
    }
  }
  return undefined;
}

function tryGetVersion(command: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    cp.execFile(command, ["--version"], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(undefined);
        return;
      }
      resolve(stdout.trim());
    });
  });
}
