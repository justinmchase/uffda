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
import type { ExceptPattern } from "./pattern.ts";

export async function except(
  pattern: ExceptPattern,
  scope: Scope,
): Promise<Match> {
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const assertion = await match(pattern.pattern, scope);
  switch (assertion.kind) {
    case MatchKind.LR:
      return assertion;
    case MatchKind.Error:
      return assertion;
    case MatchKind.Ok:
      return fail(scope, pattern, [assertion]);
    case MatchKind.Fail: {
      const next = scope.stream.next();
      const end = scope.withInput(next);
      return ok(scope, end, pattern, next.value, [assertion]);
    }
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InvalidArgument,
    `unexpected match kind ${
      (assertion as { kind?: unknown }).kind
    } in except assertion`,
  );
}
