import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { IRegExpPattern } from "./pattern.ts";

export function regexp(args: IRegExpPattern, scope: Scope) {
  const { pattern } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (typeof next.value === "string" && pattern.test(next.value)) {
      return Match.Ok(scope, scope.withInput(next), next.value);
    }
  }
  return Match.Fail(scope);
}
