import {
  type Diagnostic,
  type DiagnosticRelatedInformation,
  DiagnosticSeverity,
} from "vscode-languageserver-types";
import type {
  SessionLoadResult,
  SessionPatchFailure,
  SessionPatchResult,
} from "./mcp.session.ts";
import {
  CliStreamFailureCode,
  locationFromOffset,
  type MatchDiagnostic,
  matchDiagnostics,
} from "./stream.ts";
import type { Match } from "../match.ts";
import { anchorParseFailureLocation } from "./parse_failure_anchor.ts";

/**
 * Translates a `RuntimeSession.load()`/`patch()` outcome into the LSP
 * `Diagnostic[]` a document's URI should currently report (see
 * `.agents/specifications/languages/cli/language-server.spec.md#diagnostics`
 * and
 * `.agents/requirements/cli-language-server/004-diagnostics.requirement.md`).
 *
 * A successful outcome always yields an empty array — diagnostics are never
 * accumulated across calls, only replaced, matching `publishDiagnostics`'
 * "full current state" contract. A parse-phase failure yields one diagnostic
 * per recovery (ranged over the skipped source) and one for the parse failure
 * itself, if the parse failed (see
 * `.agents/specifications/runtime/error-recovery.spec.md#diagnostics`).
 *
 * `source` is the document's current full text, used both to compute the
 * range of a located failure (a parse failure's token, or the specifier of
 * the import a resolve failure is attributed to) and as the whole-document
 * fallback range for failures without a location. A dependency's own source
 * position, when known, is attached as `relatedInformation`.
 */
export function diagnosticsForSessionResult(
  result: SessionLoadResult | SessionPatchResult,
  source: string,
): Diagnostic[] {
  if (result.ok) return [];
  return (result.diagnostics ?? [result.error]).map((error) =>
    diagnosticForFailure(error, source)
  );
}

/**
 * The LSP `Diagnostic[]` for a document parsed with its language's grammar:
 * every parse diagnostic of `match` (see `matchDiagnostics`), with a parse
 * failure anchored like a module's (see `anchorParseFailureLocation`).
 */
export async function diagnosticsForMatch(
  match: Match,
  source: string,
): Promise<Diagnostic[]> {
  return (await matchDiagnostics(match, source)).map((diagnostic) =>
    diagnosticForFailure({
      ...diagnostic,
      phase: "parse",
      location: diagnostic.code === CliStreamFailureCode.ParseFailure
        ? anchorParseFailureLocation(match, source, diagnostic.location)
        : diagnostic.location,
    }, source)
  );
}

/**
 * The diagnostic a document reports while its language's grammar cannot be
 * loaded, ranged over the document's first line (requirement
 * cli-language-server-002).
 */
export function grammarUnavailableDiagnostic(
  message: string,
  source: string,
): Diagnostic {
  const firstLineEnd = source.indexOf("\n");
  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line: 0, character: 0 },
      end: {
        line: 0,
        character: firstLineEnd === -1 ? source.length : firstLineEnd,
      },
    },
    message,
    source: "uffda (grammar)",
    code: LSP_GRAMMAR_UNAVAILABLE,
  };
}

/** Diagnostic code of `grammarUnavailableDiagnostic`. */
export const LSP_GRAMMAR_UNAVAILABLE = "CLI_LSP_GRAMMAR_UNAVAILABLE";

type ReportedFailure =
  | SessionPatchFailure
  | (MatchDiagnostic & { phase: "parse" });

function diagnosticForFailure(
  error: ReportedFailure,
  source: string,
): Diagnostic {
  const location = "location" in error ? error.location : undefined;

  const range = location
    ? {
      start: { line: location.line, character: location.column },
      end: location.endOffset !== undefined
        ? (() => {
          const end = locationFromOffset(source, location.endOffset);
          return { line: end.line, character: end.column };
        })()
        : { line: location.line, character: location.column },
    }
    : {
      start: { line: 0, character: 0 },
      end: pointFromEnd(source),
    };

  const dependency = "dependencyFailure" in error
    ? error.dependencyFailure
    : undefined;
  const relatedInformation: DiagnosticRelatedInformation[] =
    dependency?.location
      ? [{
        location: {
          uri: dependency.moduleUrl,
          range: {
            start: {
              line: dependency.location.line,
              character: dependency.location.column,
            },
            end: {
              line: dependency.location.line,
              character: dependency.location.column,
            },
          },
        },
        message: dependency.message,
      }]
      : [];

  return {
    severity: DiagnosticSeverity.Error,
    range,
    message: error.message,
    source: `uffda (${error.phase})`,
    code: error.code,
    ...(relatedInformation.length > 0 ? { relatedInformation } : {}),
  };
}

function pointFromEnd(source: string) {
  const { line, column } = locationFromOffset(source, source.length);
  return { line, character: column };
}
