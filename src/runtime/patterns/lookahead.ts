import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { match } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { LookaheadPattern } from "./pattern.ts";

export async function lookahead(
  pattern: LookaheadPattern,
  scope: Scope,
): Promise<Match> {
  const m = await match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(scope, scope, pattern, m.value, [m]);
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InvalidArgument,
    `unexpected match kind ${
      (m as { kind?: unknown }).kind
    } in lookahead child pattern`,
  );
}
