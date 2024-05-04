import { Match, MatchKind } from "../../match.ts";
import { spanFrom } from "../../span.ts";
import { Scope } from "../scope.ts";
import { IFailPattern } from "./pattern.ts";

export function fail(pattern: IFailPattern, scope: Scope): Match {
  return {
    kind: MatchKind.Fail,
    pattern,
    scope,
    span: spanFrom(scope, scope),
    matches: [],
  };
}
