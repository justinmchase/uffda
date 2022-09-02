import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { IIncludesPattern } from "./pattern.ts";

export function includes(args: IIncludesPattern, scope: Scope) {
  const { values } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (values.includes(next.value)) {
      return Match.Ok(scope, scope.withStream(next), next.value);
    }
  }
  return Match.Fail(scope);
}