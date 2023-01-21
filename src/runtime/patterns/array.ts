import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { MetaStream } from "../../stream.ts";
import { match } from "../match.ts";
import { IArrayPattern } from "./pattern.ts";

// deno-lint-ignore no-explicit-any
function isIterable(value: any): value is Iterable<unknown> {
  if (value == null) {
    return false
  }
  return typeof value[Symbol.iterator] === "function";
}

export function array(args: IArrayPattern, scope: Scope) {
  const { pattern } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (isIterable(next.value)) {
      const innerStream = new MetaStream(
        next.path.add(0),
        next.value[Symbol.iterator](),
      );
      const innerScope = scope.withStream(innerStream);
      const m = match(pattern, innerScope);

      if (!m.matched) {
        return Match.Fail(scope);
      }

      if (!m.end.stream.done) {
        return Match.Incomplete(m.start, m.end, m.value, m.errors);
      }

      return m;
    }
  }
  return Match.Fail(scope);
}
