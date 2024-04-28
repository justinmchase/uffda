import { Scope } from "../scope.ts";
import { Match } from "../../match.ts";
import { match } from "../match.ts";
import { IAndPattern } from "./pattern.ts";

export function and(pattern: IAndPattern, scope: Scope): Match {
  const { patterns } = pattern;
  if (!patterns.length) {
    throw new Error("And pattern must have at least one pattern");
  }

  const matches: Match[] = [];
  for (const pattern of patterns) {
    const m = match(pattern, scope);
    matches.push(m);

    if (m.isLr) {
      return m;
    }

    if (!m.matched) {
      return Match.Fail(scope, pattern, matches);
    }

    scope = scope
      .addVariables(m.end.variables);
  }

  // The last match is the one that wins dictates the value and what is consumed
  const last = matches.slice(-1)[0];
  return Match.Ok(
    scope,
    last.end,
    last.value,
    pattern,
    matches,
  );
}
