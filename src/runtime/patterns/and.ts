import { Scope } from "../scope.ts";
import { Match } from "../../match.ts";
import { match } from "../match.ts";
import { IAndPattern } from "./pattern.ts";

export function and(args: IAndPattern, scope: Scope): Match {
  const { patterns } = args;
  if (!patterns.length) {
    throw new Error("And pattern must have at least one pattern");
  }

  let m = Match.Ok(scope, scope, undefined);
  for (const pattern of patterns) {
    m = match(pattern, scope);
    scope = scope.addVariables(m.end.variables);

    if (!m.matched) {
      return m;
    }
  }

  return m;
}
