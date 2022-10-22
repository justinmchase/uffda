import { Scope } from "../../scope.ts";
import { Match } from "../../match.ts";
import { match } from "../match.ts";
import { IReferencePattern } from "./pattern.ts";
import { RuntimeError, RuntimeErrorCode } from "../runtime.error.ts";

export function reference(args: IReferencePattern, scope: Scope): Match {
  const { name } = args;
  const rule = scope.getRule(name);
  if (rule) {
    if (scope.options.trace) {
      console.log(
        `#${name}: ${scope.stream.path} (${
          Deno.inspect(scope.stream.value, { colors: true, depth: 10 })
        })`,
      );
    }

    const s = scope.pushRef(name);
    const m = match(rule, s);
    return m.popRef(scope);
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
