import { Scope } from "../scope.ts";
import { Match } from "../../match.ts";
import { brightBlack } from "std/fmt/colors.ts";
import { ISpecialPattern } from "./pattern.ts";
import { run } from "../run.ts";
import { ModuleKind } from "../modules/mod.ts";
import { rule } from "../rule.ts";

export function special(pattern: ISpecialPattern, scope: Scope): Match {
  const { name, value } = pattern;
  if (value) {
    if (scope.options.trace) {
      const indent = "↪".padStart(scope.depth);
      console.log(`${indent} ${brightBlack(name)}`);
    }

    if (typeof value === "function") {
      // todo: Theoretically we could support this with a native pattern, where they pass in a function as a pattern which does custom handling.
      return Match.Fail(scope);
    }

    switch (value.kind) {
      case ModuleKind.Module:
        return run(scope.pushModule(value)).pop(scope);
      case ModuleKind.Rule:
        return rule(value, scope);
      // todo: Theoretically we could support any pattern object being inlined directly if we wanted.
      default:
        return Match.Fail(scope);
    }
  }

  return Match.Fail(scope);
}
