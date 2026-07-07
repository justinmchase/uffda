import { error, type Match, MatchErrorCode, ok } from "../../match.ts";
import { MatchKind } from "../../mod.ts";
import { match } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { MaybePattern } from "./pattern.ts";

export async function maybe(
  pattern: MaybePattern,
  scope: Scope,
): Promise<Match> {
  const m = await match(pattern.pattern, scope);
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
        [m],
      );
    case MatchKind.Fail:
      return ok(
        scope,
        scope,
        pattern,
        undefined,
        [m],
      );
  }

  return error(
    scope,
    pattern,
    MatchErrorCode.InvalidArgument,
    `unexpected match kind ${
      (m as { kind?: unknown }).kind
    } in maybe child pattern`,
  );
}
