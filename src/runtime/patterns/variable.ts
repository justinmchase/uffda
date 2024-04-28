import { yellow } from "std/fmt/colors.ts";
import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { IVariablePattern } from "./pattern.ts";

export function variable(args: IVariablePattern, scope: Scope): Match {
  const { name, pattern } = args;
  if (scope.options.trace) {
    const indent = "●".padStart(scope.depth);
    console.log(`${indent} ${yellow(name)}`);
  }

  if (scope.variables.has(name)) {
    return Match.Fail(scope, args);
  }

  const m = match(pattern, scope);
  if (m.isLr) {
    return m;
  } else if (m.matched) {
    return Match.Ok(
      scope,
      m.end.addVariables({ [name]: m.value }),
      m.value,
      args,
      [m],
    );
  } else {
    return Match.Fail(scope, args, [m]);
  }
}
