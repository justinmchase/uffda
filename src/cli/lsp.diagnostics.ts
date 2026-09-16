import {
  type Diagnostic,
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
 * `source` is the document's current full text, used both to compute a
 * point range for parse failures (which carry a precise offset/line/column)
 * and as the whole-document fallback range for compile/resolve failures
 * (which carry no location of their own).
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

  return [{
    severity: DiagnosticSeverity.Error,
    range,
    message: error.message,
    source: `uffda (${error.phase})`,
    code: error.code,
  }];
}

function pointFromEnd(source: string) {
  const { line, column } = locationFromOffset(source, source.length);
  return { line, character: column };
}
