import { Scope } from "../../scope.ts";
import { Match } from "../../match.ts";
import { match } from "../match.ts";
import { IReferencePattern } from "./pattern.ts";
import { RuntimeError, RuntimeErrorCode } from "../runtime.error.ts";
import { brightBlack, green, red } from "../../../deps/std.ts";

export function reference(args: IReferencePattern, scope: Scope): Match {
  const { name } = args;
  const rule = scope.getRule(name);
  if (rule) {
    if (scope.options.trace) {
      const indent = "›".padStart(scope.depth);
      console.log(`${indent} ${brightBlack(name)}`);
    }

    const s = scope.pushRef(name);
    const m = match(rule, s);
    const r = m.popRef(scope);

    if (scope.options.trace) {
      const indent = "›".padStart(scope.depth);
      if (m.matched) {
        console.log(`${indent} ${green(name)}`);
      } else {
        console.log(`${indent} ${red(name)}`);
      }
    }

    return r;
  } else {
    throw new RuntimeError(
      RuntimeErrorCode.PatternNotFound,
      args,
      Match.Fail(scope),
      {
        metadata: {
          name,
        },
      },
    );
  }
}
