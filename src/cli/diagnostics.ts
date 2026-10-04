import type { Match } from "../match.ts";
import {
  diagnoseRecoveries as diagnoseRecoveriesWith,
  type RecoveryDiagnostic,
} from "../match.recovery_diagnostics.ts";
import {
  analyzeMatchFailure as analyzeMatchFailureWith,
  type ExplainRule,
  type MatchFailureAnalysis,
} from "../match.visualize.ts";
import { documentationOf } from "./editor_metadata.ts";

/** A rule's `[Documentation]` `error`, which explains errors in the rule. */
export const explainRule: ExplainRule = (rule) =>
  documentationOf(rule.metadata)?.error;

/** `analyzeMatchFailure`, explaining errors with `explainRule`. */
export function analyzeMatchFailure(
  match: Match,
): Promise<MatchFailureAnalysis | undefined> {
  return analyzeMatchFailureWith(match, { explain: explainRule });
}

/** `diagnoseRecoveries`, explaining errors with `explainRule`. */
export function diagnoseRecoveries(
  match: Match,
): Promise<RecoveryDiagnostic[]> {
  return diagnoseRecoveriesWith(match, { explain: explainRule });
}
