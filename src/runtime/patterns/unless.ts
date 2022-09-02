import { Match, MatchError } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { IUnlessPattern } from "./pattern.ts";
import { match } from "../match.ts";

// This rule only matches and produces an error if the supplied pattern
// doesn't match. In which case this pattern will succeed but will produce
// an error.

export function unless(args: IUnlessPattern, scope: Scope): Match {
  const { name, message, pattern } = args;
  const m = match(pattern, scope);
  if (m.matched) {
    return m;
  } else {
    return Match.Ok(
      scope,
      m.end,
      undefined,
      [
        ...m.errors,
        new MatchError(
          name,
          message,
          scope,
          m.end,
        ),
      ],
    );
  }
}
