import { parse as parseJsonc } from "@std/jsonc";
import { resolve as resolvePath } from "@std/path";

/**
 * A single language's entry in `.uffda/lsp.jsonc` (see
 * `.agents/specifications/languages/cli/language-server.spec.md#language-configuration`
 * and
 * `.agents/requirements/cli-language-server/002-language-configuration.requirement.md`).
 */
export type LspLanguageConfigEntry = {
  /** Stable identifier for this language, used as the LSP `languageId`. */
  id: string;
  /** File extensions (without the leading dot) this language owns. */
  extensions: string[];
  /**
   * Path (relative to the workspace root) to the compiled grammar module the
   * server resolves/executes against. Optional for the built-in `.uff`
   * entry, which uses the CLI's own in-process Uffda grammar instead of a
   * resolved module.
   */
  modulePath?: string;
  /** The rule name the server parses/matches documents against. */
  entryRuleName?: string;
};

export type LspConfig = {
  languages: LspLanguageConfigEntry[];
};

export enum LspConfigLoadFailureCode {
  ReadFailure = "CLI_LSP_CONFIG_READ_FAILURE",
  ParseFailure = "CLI_LSP_CONFIG_PARSE_FAILURE",
  InvalidShape = "CLI_LSP_CONFIG_INVALID_SHAPE",
}

export type LspConfigLoadFailure = {
  code: LspConfigLoadFailureCode;
  message: string;
};

export type LspConfigLoadResult =
  | { ok: true; config: LspConfig }
  | { ok: false; error: LspConfigLoadFailure };

/**
 * The always-available `.uff` language entry. Present whether or not a
 * workspace has its own `.uffda/lsp.jsonc`, and merged ahead of any
 * user-declared entries so a workspace can never accidentally shadow it
 * (see requirement 002: "`.uff` using the same mechanism, missing/invalid
 * config handling").
 */
export const BUILTIN_UFF_LANGUAGE: LspLanguageConfigEntry = {
  id: "uffda",
  extensions: ["uff"],
};

/** Workspace-relative path to the language server's config file. */
export const LSP_CONFIG_RELATIVE_PATH = ".uffda/lsp.jsonc";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toLanguageEntry(
  value: unknown,
): LspLanguageConfigEntry | undefined {
  if (!isPlainObject(value)) return undefined;
  const { id, extensions, modulePath, entryRuleName } = value;
  if (typeof id !== "string" || id.length === 0) return undefined;
  if (
    !Array.isArray(extensions) ||
    extensions.length === 0 ||
    !extensions.every((ext) => typeof ext === "string")
  ) {
    return undefined;
  }
  if (modulePath !== undefined && typeof modulePath !== "string") {
    return undefined;
  }
  if (entryRuleName !== undefined && typeof entryRuleName !== "string") {
    return undefined;
  }
  return { id, extensions, modulePath, entryRuleName };
}

/**
 * Loads and validates `<workspaceRoot>/.uffda/lsp.jsonc`, always merging in
 * the built-in `.uff` entry. A missing config file is not an error — it
 * yields the built-in-only config, per requirement 002's "missing config"
 * handling. An unreadable-but-present file, invalid JSONC, or a config whose
 * shape doesn't match `LspConfig` is reported as a structured failure rather
 * than thrown, so callers (the LSP server) can surface it as a diagnostic
 * instead of crashing.
 */
export async function loadLspConfig(
  workspaceRoot: string,
): Promise<LspConfigLoadResult> {
  const path = resolvePath(workspaceRoot, LSP_CONFIG_RELATIVE_PATH);

  let text: string;
  try {
    text = await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return { ok: true, config: { languages: [BUILTIN_UFF_LANGUAGE] } };
    }
    return {
      ok: false,
      error: {
        code: LspConfigLoadFailureCode.ReadFailure,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonc(text);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: LspConfigLoadFailureCode.ParseFailure,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.languages)) {
    return {
      ok: false,
      error: {
        code: LspConfigLoadFailureCode.InvalidShape,
        message:
          `${LSP_CONFIG_RELATIVE_PATH} must be an object with a "languages" array`,
      },
    };
  }

  const languages: LspLanguageConfigEntry[] = [];
  for (const entry of parsed.languages) {
    const language = toLanguageEntry(entry);
    if (!language) {
      return {
        ok: false,
        error: {
          code: LspConfigLoadFailureCode.InvalidShape,
          message: `Invalid language entry in ${LSP_CONFIG_RELATIVE_PATH}: ${
            JSON.stringify(entry)
          }`,
        },
      };
    }
    languages.push(language);
  }

  // Built-in `.uff` first and always present, then user-declared entries.
  // A user entry that also declares `id: "uffda"` does not replace the
  // built-in — it is simply an additional, later entry — since resolution
  // by extension always finds the built-in `.uff` entry first.
  return {
    ok: true,
    config: { languages: [BUILTIN_UFF_LANGUAGE, ...languages] },
  };
}

/** Extracts a document's file extension (lowercased, no leading dot). */
export function extensionOf(uriOrPath: string): string {
  const withoutQuery = uriOrPath.split(/[?#]/, 1)[0];
  const lastDot = withoutQuery.lastIndexOf(".");
  const lastSlash = Math.max(
    withoutQuery.lastIndexOf("/"),
    withoutQuery.lastIndexOf("\\"),
  );
  if (lastDot === -1 || lastDot < lastSlash) return "";
  return withoutQuery.slice(lastDot + 1).toLowerCase();
}

/**
 * Resolves the language config entry that owns `uriOrPath`, by matching its
 * extension against every configured language's `extensions`. Returns
 * `undefined` for an unrecognized extension.
 */
export function resolveLanguageForDocument(
  config: LspConfig,
  uriOrPath: string,
): LspLanguageConfigEntry | undefined {
  const ext = extensionOf(uriOrPath);
  if (ext === "") return undefined;
  return config.languages.find((language) => language.extensions.includes(ext));
}
