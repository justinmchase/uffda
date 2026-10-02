import { isClean, isSuccess, type Match } from "../match.ts";
import { diagnoseRecoveries } from "../match.recovery_diagnostics.ts";
import {
  type FormatResult,
  FormatResultKind,
  formatSource,
  FormatterResolutionKind,
  type LanguageGrammar,
  resolveFormatter,
} from "../lang/format.ts";
import type { RuleInfo } from "../runtime/modules/rule_info.ts";
import { toStableSourcePath } from "../runtime/resolvers/artifact_path.ts";
import {
  grammarTargetFor,
  loadWorkspaceLanguages,
} from "./language_metadata.ts";
import {
  BUILTIN_UFF_LANGUAGE,
  describeExtensionConflict,
  extensionOf,
  type LspConfig,
  type LspLanguageConfigEntry,
  resolveLanguageForDocument,
} from "./lsp.config.ts";
import { expandSourcePaths, SourcePathFailureCode } from "./source_paths.ts";
import {
  type CliStreamFailureLocation,
  locationFromOffset,
  parseFailureLocation,
  parseFailureMessage,
} from "./stream.ts";

export enum CliFormatFailureCode {
  SourceNotFound = "CLI_FMT_SOURCE_NOT_FOUND",
  SourceNotReadable = "CLI_FMT_SOURCE_NOT_READABLE",
  /** No configured language owns the file's extension. */
  NoLanguage = "CLI_FMT_NO_LANGUAGE",
  /** The file's language has no `[Formatter]`. */
  NoFormatter = "CLI_FMT_NO_FORMATTER",
  /** The language's grammar could not be loaded. */
  GrammarUnresolved = "CLI_FMT_GRAMMAR_UNRESOLVED",
  ParseFailure = "CLI_FMT_PARSE_FAILURE",
  /** Source the parse skipped by recovering; see error-recovery.spec.md. */
  Recovered = "CLI_FMT_PARSE_RECOVERED",
  FormatFailure = "CLI_FMT_FORMAT_FAILURE",
  WriteFailure = "CLI_FMT_WRITE_FAILURE",
}

export type CliFormatFailure = {
  code: CliFormatFailureCode;
  message: string;
  location?: CliStreamFailureLocation;
};

export enum CliFormatStatus {
  /** Already canonical. */
  Unchanged = "unchanged",
  /** Rewritten, or with `--check`, not canonical. */
  Changed = "changed",
  /** Not formatted; see the file's diagnostics. */
  Failed = "failed",
}

export type CliFormatFileResult = {
  /** Path relative to the working directory, or `<stdin>`. */
  sourcePath: string;
  status: CliFormatStatus;
  /** The configured language id, when one owns the file. */
  language?: string;
  diagnostics?: CliFormatFailure[];
};

export type CliFormatResult = {
  ok: boolean;
  check: boolean;
  files: CliFormatFileResult[];
};

export type CliFormatStdinResult = CliFormatResult & {
  /** The formatted text, unless the source failed to format. */
  text?: string;
};

/** A language's grammar and the formatter its entry rule names. */
export type LanguageFormatter = {
  grammar: LanguageGrammar;
  formatter: RuleInfo;
};

/**
 * Formats documents by language, as `.uffda/lsp.jsonc` configures them;
 * see `.agents/specifications/languages/cli/formatting.spec.md`. Each
 * language's formatter is resolved once.
 */
export class LanguageFormatting {
  private readonly formatters = new Map<
    string,
    Promise<LanguageFormatter | CliFormatFailure>
  >();

  constructor(
    private readonly config: LspConfig,
    private readonly workspaceRoot: string,
  ) {}

  /** Loads the workspace's language configuration. */
  static async load(
    workspaceRoot: string,
  ): Promise<LanguageFormatting | { error: string }> {
    const loaded = await loadWorkspaceLanguages(workspaceRoot);
    if (!loaded.ok) return { error: loaded.error.message };
    if (loaded.conflicts.length > 0) {
      return {
        error: loaded.conflicts.map(describeExtensionConflict).join("\n"),
      };
    }
    return new LanguageFormatting(loaded.config, workspaceRoot);
  }

  /** The language owning `uriOrPath`, by extension. */
  public languageFor(uriOrPath: string): LspLanguageConfigEntry | undefined {
    return resolveLanguageForDocument(this.config, uriOrPath);
  }

  /** Formats `source` as `language`, failing with diagnostics. */
  public async format(
    language: LspLanguageConfigEntry,
    source: string,
  ): Promise<{ text: string } | { diagnostics: CliFormatFailure[] }> {
    const resolved = await this.formatterOf(language);
    if ("code" in resolved) return { diagnostics: [resolved] };
    const { grammar, formatter } = resolved;
    return await toFormatOutcome(
      await formatSource(grammar, source, formatter),
      source,
    );
  }

  /**
   * The grammar and formatter of `language`, or why it cannot be formatted
   * (`NoFormatter` when it names none).
   */
  public formatterOf(
    language: LspLanguageConfigEntry,
  ): Promise<LanguageFormatter | CliFormatFailure> {
    let formatter = this.formatters.get(language.id);
    if (!formatter) {
      formatter = this.resolve(language);
      this.formatters.set(language.id, formatter);
    }
    return formatter;
  }

  private async resolve(
    language: LspLanguageConfigEntry,
  ): Promise<LanguageFormatter | CliFormatFailure> {
    const grammar = grammarTargetFor(language, this.workspaceRoot);
    if (!grammar) {
      return {
        code: CliFormatFailureCode.NoFormatter,
        message: `Language '${language.id}' declares no grammar to format with`,
      };
    }
    const resolution = await resolveFormatter(grammar);
    switch (resolution.kind) {
      case FormatterResolutionKind.Found:
        return { grammar, formatter: resolution.formatter };
      case FormatterResolutionKind.NoFormatter:
        return {
          code: CliFormatFailureCode.NoFormatter,
          message:
            `Language '${language.id}' has no [Formatter] on rule ${grammar.entryRuleName}`,
        };
      case FormatterResolutionKind.Unresolved:
        return {
          code: CliFormatFailureCode.GrammarUnresolved,
          message:
            `Unable to load the grammar of language '${language.id}': ${await parseFailureMessage(
              resolution.match,
            )}`,
        };
    }
  }
}

async function parseDiagnostics(
  match: Match,
  source: string,
): Promise<CliFormatFailure[]> {
  const recoveries = (await diagnoseRecoveries(match)).map((
    { span, message },
  ) => ({
    code: CliFormatFailureCode.Recovered,
    message,
    location: {
      ...locationFromOffset(source, span.start),
      endOffset: Math.min(source.length, span.end),
    },
  }));
  if (isSuccess(match)) return recoveries;
  return [...recoveries, {
    code: CliFormatFailureCode.ParseFailure,
    message: await parseFailureMessage(match),
    location: await parseFailureLocation(match, source),
  }];
}

async function toFormatOutcome(
  result: FormatResult,
  source: string,
): Promise<{ text: string } | { diagnostics: CliFormatFailure[] }> {
  switch (result.kind) {
    case FormatResultKind.Formatted:
      return { text: result.text };
    case FormatResultKind.NoFormatter:
      return {
        diagnostics: [{
          code: CliFormatFailureCode.NoFormatter,
          message: "The language has no [Formatter]",
        }],
      };
    case FormatResultKind.Unresolved:
      return {
        diagnostics: [{
          code: CliFormatFailureCode.GrammarUnresolved,
          message: await parseFailureMessage(result.match),
        }],
      };
    case FormatResultKind.ParseFailed:
      return { diagnostics: await parseDiagnostics(result.match, source) };
    case FormatResultKind.FormatFailed:
      return {
        diagnostics: [{
          code: CliFormatFailureCode.FormatFailure,
          message: isClean(result.match) && isSuccess(result.match)
            ? result.message
            : `${result.message}: ${await parseFailureMessage(result.match)}`,
        }],
      };
  }
}

function noLanguage(path: string): CliFormatFailure {
  const ext = extensionOf(path);
  return {
    code: CliFormatFailureCode.NoLanguage,
    message: ext === ""
      ? "No configured language owns a file without an extension"
      : `No configured language owns the '.${ext}' extension`,
  };
}

/** What `fmt` formats when given no paths. */
export const FMT_DEFAULT_GLOB = "**/*";

/** Directories `fmt`'s globs never descend into. */
export const FMT_GLOB_EXCLUDES = ["**/.git", "**/node_modules"];

/**
 * Formats files and globs in place, or with `check` only reports which are
 * not canonical; with no paths, every file under `cwd`. A file named by a
 * path MUST have a language with a formatter. A file matched by a glob is
 * skipped, and left out of the result, when its extension has no language or
 * its language has no formatter. A file that does not parse cleanly is never
 * rewritten.
 */
export async function formatFiles(options: {
  formatting: LanguageFormatting;
  cwd: string;
  sourcePaths: string[];
  check: boolean;
}): Promise<CliFormatResult> {
  const { formatting, cwd, sourcePaths, check } = options;
  const defaulted = sourcePaths.length === 0;
  const expanded = await expandSourcePaths(
    cwd,
    defaulted ? [FMT_DEFAULT_GLOB] : sourcePaths,
    FMT_GLOB_EXCLUDES,
  );
  const failures = defaulted ? [] : expanded.failures;
  const files: CliFormatFileResult[] = failures.map((failure) => ({
    sourcePath: failure.sourcePath,
    status: CliFormatStatus.Failed,
    diagnostics: [{
      code: failure.code === SourcePathFailureCode.NotFound
        ? CliFormatFailureCode.SourceNotFound
        : CliFormatFailureCode.SourceNotReadable,
      message: failure.message,
    }],
  }));

  for (const path of expanded.files) {
    const explicit = expanded.explicit.has(path);
    const file = await formatFile(formatting, cwd, path, check, explicit);
    if (file) files.push(file);
  }

  return {
    ok: files.every((file) =>
      file.status === CliFormatStatus.Unchanged ||
      (file.status === CliFormatStatus.Changed && !check)
    ),
    check,
    files,
  };
}

async function formatFile(
  formatting: LanguageFormatting,
  cwd: string,
  path: string,
  check: boolean,
  explicit: boolean,
): Promise<CliFormatFileResult | undefined> {
  const sourcePath = toStableSourcePath(cwd, path);
  const language = formatting.languageFor(path);
  if (!language) {
    if (!explicit) return undefined;
    return {
      sourcePath,
      status: CliFormatStatus.Failed,
      diagnostics: [noLanguage(path)],
    };
  }
  const failed = (diagnostics: CliFormatFailure[]) => ({
    sourcePath,
    status: CliFormatStatus.Failed,
    language: language.id,
    diagnostics,
  });

  const formatter = await formatting.formatterOf(language);
  if ("code" in formatter) {
    const skip = !explicit &&
      formatter.code === CliFormatFailureCode.NoFormatter;
    return skip ? undefined : failed([formatter]);
  }

  let source: string;
  try {
    source = await Deno.readTextFile(path);
  } catch (error) {
    return failed([{
      code: CliFormatFailureCode.SourceNotReadable,
      message: error instanceof Error ? error.message : String(error),
    }]);
  }

  const formatted = await formatting.format(language, source);
  if ("diagnostics" in formatted) return failed(formatted.diagnostics);
  if (formatted.text === source) {
    return {
      sourcePath,
      status: CliFormatStatus.Unchanged,
      language: language.id,
    };
  }
  if (!check) {
    try {
      await Deno.writeTextFile(path, formatted.text);
    } catch (error) {
      return failed([{
        code: CliFormatFailureCode.WriteFailure,
        message: error instanceof Error ? error.message : String(error),
      }]);
    }
  }
  return { sourcePath, status: CliFormatStatus.Changed, language: language.id };
}

/**
 * Formats standard input as a `.uff` module, returning the formatted text
 * unless `check` is set.
 */
export async function formatStdin(options: {
  formatting: LanguageFormatting;
  source: string;
  check: boolean;
}): Promise<CliFormatStdinResult> {
  const { formatting, source, check } = options;
  const sourcePath = "<stdin>";
  const language = BUILTIN_UFF_LANGUAGE;
  const formatted = await formatting.format(language, source);
  if ("diagnostics" in formatted) {
    return {
      ok: false,
      check,
      files: [{
        sourcePath,
        status: CliFormatStatus.Failed,
        language: language.id,
        diagnostics: formatted.diagnostics,
      }],
    };
  }
  const changed = formatted.text !== source;
  return {
    ok: !(check && changed),
    check,
    files: [{
      sourcePath,
      status: changed ? CliFormatStatus.Changed : CliFormatStatus.Unchanged,
      language: language.id,
    }],
    ...(check ? {} : { text: formatted.text }),
  };
}
