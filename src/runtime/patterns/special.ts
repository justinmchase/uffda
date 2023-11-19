import { Scope } from "../scope.ts";
import { Match } from "../../match.ts";
import { RuntimeError, RuntimeErrorCode } from "../runtime.error.ts";
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
      throw new RuntimeError(
        RuntimeErrorCode.UnknownSpecialKind,
        scope.module,
        scope.ruleStack[-1],
        pattern,
        Match.Fail(scope),
        {
          metadata: {
            name,
          },
        },
      );
    }

    switch (value.kind) {
      case ModuleKind.Module:
        return run(scope.pushModule(value)).pop(scope);
      case ModuleKind.Rule:
        return rule(value, scope);
      // todo: Theoretically we could support any pattern object being inlined directly if we wanted.
      default:
        return Match.Fail(scope).pushError(
          "UnknownSpecialKind",
          `A special reference has an uknown kind ${value.kind}`,
          scope,
          scope,
        );
    }
  }

  // todo: Maybe a more specific error is needed but this should never happen without a bad ast object
  throw new RuntimeError(
    RuntimeErrorCode.UnknownReference,
    scope.module,
    scope.ruleStack[-1],
    pattern,
    Match.Fail(scope),
    {
      metadata: {
        name,
        value,
      },
    },
  );
}
