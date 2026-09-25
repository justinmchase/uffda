import {
  type Diagnostic,
  type DiagnosticRelatedInformation,
  DiagnosticSeverity,
} from "vscode-languageserver-types";
import type { SessionLoadResult, SessionPatchResult } from "./mcp.session.ts";
import { locationFromOffset } from "./stream.ts";

/**
 * Translates a `RuntimeSession.load()`/`patch()` outcome into the LSP
 * `Diagnostic[]` a document's URI should currently report (see
 * `.agents/specifications/languages/cli/language-server.spec.md#diagnostics`
 * and
 * `.agents/requirements/cli-language-server/004-diagnostics.requirement.md`).
 *
 * A successful outcome always yields an empty array — diagnostics are never
 * accumulated across calls, only replaced, matching `publishDiagnostics`'
 * "full current state" contract.
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

  const { error } = result;
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

  return [{
    severity: DiagnosticSeverity.Error,
    range,
    message: error.message,
    source: `uffda (${error.phase})`,
    code: error.code,
    ...(relatedInformation.length > 0 ? { relatedInformation } : {}),
  }];
}

function pointFromEnd(source: string) {
  const { line, column } = locationFromOffset(source, source.length);
  return { line, character: column };
}
