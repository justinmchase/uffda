import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { match } from "../match.ts";
import { exec } from "../exec.ts";
import { IProjectionPattern } from "./pattern.ts";
import { black } from "../../../deps/std.ts";

export function projection(args: IProjectionPattern, scope: Scope) {
  const { pattern, expression } = args;
  const m = match(pattern, scope);
  if (!m.matched) {
    return m;
  }
  const value = exec(expression, m);

  
  if (scope.options.trace) {
    const indent = "->".padStart(scope.depth);
    console.log(`${indent} [${black(Deno.inspect(value))}]`);
  }

  // m.setSpan(value)
  // scope.setSpan(value, m.end);
  return Match.Ok(
    scope,
    m.end,
    value,
    m.errors,
  );
}
