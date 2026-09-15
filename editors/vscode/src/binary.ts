import * as cp from "node:child_process";
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
  minVersion?: string;
}

/**
 * Resolves the command used to launch `uffda`, per requirement
 * cli-language-server-007: an explicit override always wins (used verbatim,
 * no PATH/version/download checks); otherwise prefer a PATH binary whose
 * version satisfies the minimum; otherwise download and cache the
 * platform-matching release binary.
 */
export async function resolveUffdaServer(opts: ResolveOptions): Promise<ResolvedServer> {
  if (opts.serverPathOverride) {
    return {
      command: opts.serverPathOverride,
      args: opts.serverArgsOverride && opts.serverArgsOverride.length > 0
        ? opts.serverArgsOverride
        : opts.defaultArgs,
      source: "override",
    };
  }

  const minVersion = opts.minVersion ?? MIN_UFFDA_VERSION;
  const pathVersion = await tryGetPathVersion();
  if (pathVersion && satisfiesMinVersion(pathVersion, minVersion)) {
    return { command: "uffda", args: opts.defaultArgs, source: "path" };
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
          `install a compatible uffda on PATH or use the uffda.lsp.serverPath override.`,
      );
    }
    return { command: binaryPath, args: opts.defaultArgs, source: "download" };
  } catch (err) {
    if (err instanceof ResolveServerError) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    const pathNote = pathVersion
      ? `A uffda binary was found on PATH (version ${pathVersion}) but does not satisfy the minimum required version ${minVersion}.`
      : `No uffda binary was found on PATH.`;
    throw new ResolveServerError(
      `${pathNote} Automatic download also failed: ${reason}`,
    );
  }
}

function tryGetPathVersion(): Promise<string | undefined> {
  return tryGetVersion("uffda");
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
