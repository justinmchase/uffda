import { Scope } from "../../scope.ts";
import { Match } from "../../match.ts";
import { match } from "../match.ts";
import { IBlockPattern } from "./pattern.ts";
import { blue } from "../../../deps/std.ts";

export function block(args: IBlockPattern, scope: Scope): Match {
  const { rules } = args;
  const [name, pattern] = Object.entries(rules).pop() ?? [];
  if (pattern) {
    const subScope = scope
      .setRules(rules)
      .push();

    if (scope.options.trace) {
      const indent = "›".padStart(subScope.depth);
      console.log(`${indent} ${blue(name ?? pattern.kind)}`);
    }

    const result = match(pattern, subScope);
    return result.pop();
  } else {
    return Match.Ok(scope, scope, undefined);
  }
}
