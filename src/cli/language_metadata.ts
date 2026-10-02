import { resolve as resolvePath } from "@std/path";
import { resolveGrammarModule } from "../lang/grammar.ts";
import {
  BUILTIN_UFF_LANGUAGE,
  type LanguageExtensionConflict,
  loadLspConfig,
  type LspConfig,
  type LspConfigLoadFailure,
  type LspLanguageConfigEntry,
  resolveExtensionOwnership,
  withExtensionFromMetadata,
} from "./lsp.config.ts";

/**
 * Editor-facing facts about a language, from its grammar's own `[Language]`
 * decorator metadata (see `src/lang/uffda/uffda.lang.uff`). Every field is
 * optional, and `[Language]` may carry further properties this module
 * ignores. Comment syntax and bracket pairs are not language metadata:
 * comment toggling comes from `[ToggleComment]`, and the editor declares no
 * brackets (see
 * `.agents/specifications/languages/cli/language-server.spec.md#vs-code-extension`).
 */
export type LanguageMetadata = {
  /** File extension (including the leading dot, e.g. `.uff`). */
  ext?: string;
  /** Editor-facing display name. */
  name?: string;
  /** Editor-facing description. */
  description?: string;
};

/** Custom LSP request: query `[Language]` metadata for configured languages. */
export const LANGUAGE_METADATA_METHOD = "uffda/languageMetadata";

export type LanguageMetadataParams = {
  /** When set, only this language id is queried; otherwise every configured entry. */
  languageId?: string;
};

export type LanguageMetadataEntry = {
  id: string;
  metadata: LanguageMetadata;
};

export type LanguageMetadataResult = {
  languages: LanguageMetadataEntry[];
};

const LANGUAGE_DECORATOR_NAME = "Language";

/** The built-in `.uff` language's own grammar module and entry rule — the
 * only language this CLI version resolves `[Language]` metadata for
 * without a configured `modulePath` (see `grammarTargetFor`). */
const UFFDA_MODULE_URL = new URL(
  "../lang/uffda/uffda.lang.uff",
  import.meta.url,
);
const UFFDA_ENTRY_RULE_NAME = "UffdaLang";

/**
 * Validates/coerces a decorator's raw `Language` metadata return value into
 * the shape this module trusts, dropping any malformed or unrecognized
 * field rather than propagating an arbitrary shape to callers — a grammar
 * author controls the attribute's *values*, not this module's contract.
 */
export function toLanguageMetadata(
  value: unknown,
): LanguageMetadata | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  const metadata: LanguageMetadata = {};
  if (typeof v.ext === "string") metadata.ext = v.ext;
  if (typeof v.name === "string") metadata.name = v.name;
  if (typeof v.description === "string") metadata.description = v.description;
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Resolves the module URL + entry rule name `language` should be queried
 * against: its `modulePath` (relative to `workspaceRoot`) and
 * `entryRuleName` when it declares both (see
 * `.agents/requirements/cli-language-server/002-language-configuration.requirement.md`),
 * otherwise the CLI's bundled grammar for the built-in `.uff` language id.
 * Returns `undefined` for any other entry missing those inputs.
 */
export function grammarTargetFor(
  language: LspLanguageConfigEntry,
  workspaceRoot: string,
): { moduleUrl: URL; entryRuleName: string } | undefined {
  if (language.modulePath && language.entryRuleName) {
    return {
      moduleUrl: new URL(
        `file://${resolvePath(workspaceRoot, language.modulePath)}`,
      ),
      entryRuleName: language.entryRuleName,
    };
  }
  if (language.id === BUILTIN_UFF_LANGUAGE.id) {
    return {
      moduleUrl: UFFDA_MODULE_URL,
      entryRuleName: UFFDA_ENTRY_RULE_NAME,
    };
  }
  return undefined;
}

/**
 * Queries `language`'s own entry rule for `[Language]` decorator metadata,
 * so an editor extension can derive its language configuration
 * dynamically from the grammar itself instead of a hand-maintained static
 * file. Returns `undefined` if the entry rule carries no `Language`
 * metadata, or if the language's grammar module cannot be resolved (an
 * unresolvable module is not itself surfaced as an error here — document
 * open/change handling already reports that separately).
 */
export async function loadLanguageMetadata(
  language: LspLanguageConfigEntry,
  workspaceRoot: string,
): Promise<LanguageMetadata | undefined> {
  const target = grammarTargetFor(language, workspaceRoot);
  if (!target) return undefined;

  const resolved = await resolveGrammarModule({
    moduleUrl: target.moduleUrl,
    entryRuleName: target.entryRuleName,
  });
  if (!resolved.ok) return undefined;

  const rule = resolved.resolved.module.rules.get(target.entryRuleName);
  return toLanguageMetadata(rule?.metadata?.[LANGUAGE_DECORATOR_NAME]);
}

/**
 * Handles the `uffda/languageMetadata` custom LSP request: loads `[Language]`
 * metadata for each configured language (or a single `languageId`), so
 * clients can map file extensions to language ids.
 */
export async function languageMetadataForConfig(
  config: LspConfig,
  workspaceRoot: string,
  params?: LanguageMetadataParams,
): Promise<LanguageMetadataResult> {
  const entries = params?.languageId
    ? config.languages.filter((language) => language.id === params.languageId)
    : config.languages;

  const languages: LanguageMetadataEntry[] = [];
  for (const language of entries) {
    const metadata = await loadLanguageMetadata(language, workspaceRoot);
    if (!metadata) continue;
    languages.push({ id: language.id, metadata });
  }
  return { languages };
}

/**
 * Fills empty `extensions` arrays from each language's `[Language].ext`
 * metadata. Workspace JSON extensions always win when already present.
 */
export async function enrichLspConfigWithLanguageMetadata(
  config: LspConfig,
  workspaceRoot: string,
): Promise<LspConfig> {
  const languages = [];
  for (const language of config.languages) {
    if (language.extensions.length > 0) {
      languages.push(language);
      continue;
    }
    const metadata = await loadLanguageMetadata(language, workspaceRoot);
    languages.push(withExtensionFromMetadata(language, metadata?.ext));
  }
  return { languages };
}

export type WorkspaceLanguagesResult =
  | {
    ok: true;
    config: LspConfig;
    /** Extensions no language serves because several claim them. */
    conflicts: LanguageExtensionConflict[];
  }
  | { ok: false; error: LspConfigLoadFailure };

/**
 * The languages a workspace serves, as the language server and `uffda fmt`
 * both read them: `.uffda/lsp.jsonc`, with omitted extensions filled from
 * `[Language]` metadata, then each extension given at most one language
 * (see `resolveExtensionOwnership`).
 */
export async function loadWorkspaceLanguages(
  workspaceRoot: string,
): Promise<WorkspaceLanguagesResult> {
  const loaded = await loadLspConfig(workspaceRoot);
  if (!loaded.ok) return loaded;
  const enriched = await enrichLspConfigWithLanguageMetadata(
    loaded.config,
    workspaceRoot,
  );
  return { ok: true, ...resolveExtensionOwnership(enriched) };
}
