import { Scope } from "../../scope.ts";
import { Match } from "../../match.ts";
import { IReferencePattern } from "./pattern.ts";
import { RuntimeError, RuntimeErrorCode } from "../runtime.error.ts";
import { brightBlack, green, red } from "../../../deps/std.ts";
import { rule } from "../rule.ts";

export function reference(pattern: IReferencePattern, scope: Scope): Match {
  const { name } = pattern;
  const ref = scope.getRule(name);
  if (ref) {
    if (scope.options.trace) {
      const indent = "›".padStart(scope.depth);
      console.log(`${indent} ${brightBlack(name)}`);
    }

    const m = rule(ref, scope);

    if (scope.options.trace) {
      const indent = "›".padStart(scope.depth);
      if (m.matched) {
        console.log(`${indent} ${green(name)}`);
      } else {
        console.log(`${indent} ${red(name)}`);
      }
    }
    
    return m;
  } else {
    throw new RuntimeError(
      RuntimeErrorCode.PatternNotFound,
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
}
