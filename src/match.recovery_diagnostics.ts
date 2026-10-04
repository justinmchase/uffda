import type { Match, SourceSpan } from "./match.ts";
import { describePattern } from "./match.describe_pattern.ts";
import {
  analyzeMatchFailure,
  formatMatchFailureSummary,
  type MatchFailureAnalysis,
  type MatchFailureOptions,
} from "./match.visualize.ts";
import { collectRecoveries } from "./runtime/recovery.ts";

/**
 * One diagnostic per recovery in a parse (see
 * `.agents/specifications/runtime/error-recovery.spec.md#diagnostics`).
 */
export type RecoveryDiagnostic = {
  /** Source offsets of the input the recovery skipped. */
  span: SourceSpan;
  /** The match-diagnostics summary of the failure the recovery replaced. */
  message: string;
  analysis?: MatchFailureAnalysis;
};

/**
 * The diagnostics of every recovery in `match`'s accepted parse, in document
 * order. Empty for a match without recoveries.
 */
export async function diagnoseRecoveries(
  match: Match,
  options: MatchFailureOptions = {},
): Promise<RecoveryDiagnostic[]> {
  const diagnostics: RecoveryDiagnostic[] = [];
  for (
    const { match: recovered, failure, preceding } of collectRecoveries(match)
  ) {
    const analysis = await analyzeMatchFailure(failure, {
      ...options,
      preceding,
    });
    diagnostics.push({
      span: recovered.originalSpan,
      message: analysis
        ? formatMatchFailureSummary(analysis)
        : `Expected ${describePattern(failure.pattern)}`,
      ...(analysis ? { analysis } : {}),
    });
  }
  return diagnostics;
}
