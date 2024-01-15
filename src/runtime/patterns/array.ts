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

export function array(args: IArrayPattern, scope: Scope) {
  const { pattern } = args;
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
        next.path.push(0),
      );
      const innerScope = scope.withInput(innerStream);
      const m = match(pattern, innerScope);
      if (!m.matched) {
        return Match.Fail(scope);
      }

      if (!m.end.stream.done) {
        return Match.Fail(scope);
      }

      return m;
    }
  }
  return Match.Fail(scope);
}
