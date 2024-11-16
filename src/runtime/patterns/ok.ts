import type { Match } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import { spanFrom } from "../../span.ts";
import type { Scope } from "../scope.ts";
import type { OkPattern } from "./pattern.ts";

export function ok(pattern: OkPattern, scope: Scope): Match {
  return {
    kind: MatchKind.Ok,
    pattern,
    scope,
    span: spanFrom(scope, scope),
    value: undefined,
    matches: [],
  };
}
