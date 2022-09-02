import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { match } from "../match.ts";
import { IMustPattern } from "./pattern.ts";

// This rule only matches and produces an error if the supplied pattern
// doesn't match. In which case this pattern will succeed but will produce
// an error.

export function must(args: IMustPattern, scope: Scope): Match {
  const { name, message, pattern } = args;
  const m = match(pattern, scope);
  if (m.matched) {
    return m;
  }

  return Match
    .Ok(scope, m.end, undefined, m.errors)
    .pushError(
      name,
      message,
      m.start,
      m.end,
    );
}
