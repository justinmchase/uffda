import {
  type LspConfig,
  type LspLanguageConfigEntry,
  withExtensionFromMetadata,
} from "./lsp.config.ts";
import type { LspGrammarProvider } from "./lsp.grammars.ts";

/**
 * Editor-facing language configuration, derived from a grammar's own
 * `[Language]` decorator metadata (see `src/lang/uffda/uffda.lang.uff`)
 * rather than a hand-maintained static file — the direction
 * `.agents/specifications/languages/cli/language-server.spec.md#vs-code-extension`
 * describes. Every field is optional: a grammar author may declare as few
 * or as many as are meaningful for that language, and `[Language]` itself
 * may carry further, not-yet-standardized properties (a future
 * `wordPattern`, for example) that this module simply ignores today.
 */
export type LanguageMetadata = {
  /** File extension (including the leading dot, e.g. `.uff`). */
  ext?: string;
  /** Editor-facing display name. */
  name?: string;
  /** Editor-facing description. */
  description?: string;
  /** Line-comment prefix (no block-comment support yet). */
  comment?: string;
  /** Bracket pairs contributing to bracket matching. */
  brackets?: LanguageBracketPair[];
  /** Pairs the editor should auto-close as the opener is typed. */
  autoClosingPairs?: LanguageBracketPair[];
  /** Pairs the editor should wrap a selection in. */
  surroundingPairs?: LanguageBracketPair[];
};

export type LanguageBracketPair = [open: string, close: string];

/**
 * VS Code / editor `LanguageConfiguration`-shaped projection of
 * `LanguageMetadata` (see
 * https://code.visualstudio.com/api/language-extensions/language-configuration-guide).
 * Returned by the `uffda/languageMetadata` LSP request so clients can call
 * `setLanguageConfiguration` without re-deriving field names.
 */
export type EditorLanguageConfiguration = {
  comments?: { lineComment?: string };
  brackets?: LanguageBracketPair[];
  autoClosingPairs?: Array<{ open: string; close: string }>;
  surroundingPairs?: LanguageBracketPair[];
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
  configuration: EditorLanguageConfiguration;
};

export type LanguageMetadataResult = {
  languages: LanguageMetadataEntry[];
};

const LANGUAGE_DECORATOR_NAME = "Language";

function isBracketPair(value: unknown): value is LanguageBracketPair {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === "string" && typeof value[1] === "string";
}

function toBracketPairs(value: unknown): LanguageBracketPair[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const pairs = value.filter(isBracketPair);
  return pairs.length > 0 ? pairs : undefined;
}

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
  if (typeof v.comment === "string") metadata.comment = v.comment;
  const brackets = toBracketPairs(v.brackets);
  if (brackets) metadata.brackets = brackets;
  const autoClosingPairs = toBracketPairs(v.autoClosingPairs);
  if (autoClosingPairs) metadata.autoClosingPairs = autoClosingPairs;
  const surroundingPairs = toBracketPairs(v.surroundingPairs);
  if (surroundingPairs) metadata.surroundingPairs = surroundingPairs;
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Projects `LanguageMetadata` into the editor configuration shape VS Code's
 * `languages.setLanguageConfiguration()` accepts. Returns `undefined` when
 * there is nothing editor-facing to apply (e.g. only `ext`/`name` were set).
 */
export function toEditorLanguageConfiguration(
  metadata: LanguageMetadata,
): EditorLanguageConfiguration | undefined {
  const configuration: EditorLanguageConfiguration = {};
  if (metadata.comment !== undefined) {
    configuration.comments = { lineComment: metadata.comment };
  }
  if (metadata.brackets) configuration.brackets = metadata.brackets;
  if (metadata.autoClosingPairs) {
    configuration.autoClosingPairs = metadata.autoClosingPairs.map(
      ([open, close]) => ({ open, close }),
    );
  }
  if (metadata.surroundingPairs) {
    configuration.surroundingPairs = metadata.surroundingPairs;
  }
  return Object.keys(configuration).length > 0 ? configuration : undefined;
}

/**
 * Queries `language`'s own entry rule for `[Language]` decorator metadata,
 * so an editor extension can derive its language configuration
 * dynamically from the grammar itself instead of a hand-maintained static
 * file. The grammar is the one `grammars` resolves for the language's
 * documents. Returns `undefined` if the entry rule carries no `Language`
 * metadata, or if the language's grammar cannot be loaded (not itself
 * surfaced as an error here — the language's documents already report it).
 */
export async function loadLanguageMetadata(
  language: LspLanguageConfigEntry,
  grammars: LspGrammarProvider,
): Promise<LanguageMetadata | undefined> {
  const resolved = await grammars.grammarFor(language);
  if (!resolved.ok) return undefined;
  const { module, entryRuleName } = resolved.grammar;
  const rule = module.rules.get(entryRuleName);
  return toLanguageMetadata(rule?.metadata?.[LANGUAGE_DECORATOR_NAME]);
}

/**
 * Handles the `uffda/languageMetadata` custom LSP request: loads `[Language]`
 * metadata for each configured language (or a single `languageId`) and
 * returns both the raw metadata and its editor-configuration projection.
 * Entries with only `ext`/`name` (no editor pairs) are still returned so
 * clients can map file extensions → language ids.
 */
export async function languageMetadataForConfig(
  config: LspConfig,
  grammars: LspGrammarProvider,
  params?: LanguageMetadataParams,
): Promise<LanguageMetadataResult> {
  const entries = params?.languageId
    ? config.languages.filter((language) => language.id === params.languageId)
    : config.languages;

  const languages: LanguageMetadataEntry[] = [];
  for (const language of entries) {
    const metadata = await loadLanguageMetadata(language, grammars);
    if (!metadata) continue;
    languages.push({
      id: language.id,
      metadata,
      configuration: toEditorLanguageConfiguration(metadata) ?? {},
    });
  }
  return { languages };
}

/**
 * Fills empty `extensions` arrays from each language's `[Language].ext`
 * metadata. Workspace JSON extensions always win when already present.
 */
export async function enrichLspConfigWithLanguageMetadata(
  config: LspConfig,
  grammars: LspGrammarProvider,
): Promise<LspConfig> {
  const languages = [];
  for (const language of config.languages) {
    if (language.extensions.length > 0) {
      languages.push(language);
      continue;
    }
    const metadata = await loadLanguageMetadata(language, grammars);
    languages.push(withExtensionFromMetadata(language, metadata?.ext));
  }
  return { languages };
}
