import { Match, ok } from "../../match.ts";
import { MatchKind } from "../../mod.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import { MaybePattern } from "./pattern.ts";

export function maybe(pattern: MaybePattern, scope: Scope): Match {
  const m = match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Ok:
      return ok(
        scope,
        m.scope,
        pattern,
        m.value,
        [m]
      )
    case MatchKind.Fail:
      return ok(
        scope,
        scope,
        pattern,
        undefined,
        [m]
      );
  }
}
