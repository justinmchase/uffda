import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import type { Scope } from "../scope.ts";
import { match } from "../match.ts";
import type { NotPattern } from "./pattern.ts";

export async function not(pattern: NotPattern, scope: Scope): Promise<Match> {
  const m = await match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Ok:
      return fail(scope, pattern, [m]);
    case MatchKind.Fail:
      return ok(scope, m.scope, pattern, undefined, [m]);
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InvalidArgument,
    `unexpected match kind ${
      (m as { kind?: unknown }).kind
    } in not child pattern`,
  );
}
