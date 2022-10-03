import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { match } from "../match.ts";
import { IVariablePattern } from "./pattern.ts";

export function variable(args: IVariablePattern, scope: Scope): Match {
  const { name, pattern } = args;
  const m = match(pattern, scope);
  if (m.matched) {
    return Match.Ok(
      scope,
      m.end.addVariables({ [name]: m.value }),
      m.value,
      m.errors,
    );
  } else {
    return m;
  }
}
