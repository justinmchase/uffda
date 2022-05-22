import { Scope } from "../../scope.ts";
import { Match } from "../../match.ts";
import { match } from "../match.ts";
import { IBlockPattern } from "./pattern.ts";

export function block(args: IBlockPattern, scope: Scope): Match {
  const { rules } = args;
  const pattern = Object.entries(rules).pop()?.[1];
  if (pattern) {
    const subScope = scope
      .setRules(rules)
      .push();

    const result = match(pattern, subScope);
    return result.pop();
  } else {
    return Match.Ok(scope, scope, undefined);
  }
}
