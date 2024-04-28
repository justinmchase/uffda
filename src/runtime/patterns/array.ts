import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import { IArrayPattern } from "./pattern.ts";

// deno-lint-ignore no-explicit-any
function isIterable(value: any): value is Iterable<unknown> {
  if (value == null) {
    return false;
  }
  return typeof value[Symbol.iterator] === "function";
}

export function array(arrayPattern: IArrayPattern, scope: Scope) {
  const { pattern } = arrayPattern;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (isIterable(next.value)) {
      if (scope.options.trace) {
        console.log(
          `* [${next.value}] ${(next.value as [])?.length ?? "<none>"}`,
        );
      }
      const innerStream = new Input(
        next.value,
        scope.stream.path.push(0),
      );
      const innerScope = scope
        .withInput(innerStream);

      const m = match(pattern, innerScope);
      if (!m.matched) {
        return Match.Fail(scope, arrayPattern, [m]);
      }

      if (!m.end.stream.done) {
        return Match.Fail(scope, arrayPattern, [m]);
      }

      return Match.Ok(
        scope,
        scope
          .withInput(next)
          .addVariables(m.end.variables),
        m.value,
        arrayPattern,
        [m],
      );
    }
  }

  return Match.Fail(scope, arrayPattern);
}
