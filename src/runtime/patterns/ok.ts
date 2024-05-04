import { Match } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import { spanFrom } from "../../span.ts";
import { Scope } from "../scope.ts";
import { IOkPattern } from "./pattern.ts";

export function ok(pattern: IOkPattern, scope: Scope): Match {
  return {
    kind: MatchKind.Ok,
    pattern,
    scope,
    span: spanFrom(scope, scope),
    value: undefined,
    matches: [],
  };
}
