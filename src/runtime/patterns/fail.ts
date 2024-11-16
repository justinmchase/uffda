import { type Match, MatchKind } from "../../match.ts";
import { spanFrom } from "../../span.ts";
import type { Scope } from "../scope.ts";
import type { FailPattern } from "./pattern.ts";

export function fail(pattern: FailPattern, scope: Scope): Match {
  return {
    kind: MatchKind.Fail,
    pattern,
    scope,
    span: spanFrom(scope, scope),
    matches: [],
  };
}
