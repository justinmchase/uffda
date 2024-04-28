import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IRegExpPattern } from "./pattern.ts";

export function regexp(regexPattern: IRegExpPattern, scope: Scope) {
  const { pattern } = regexPattern;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (typeof next.value !== "string") {
      return Match.Fail(scope, regexPattern);
    }

    if (pattern.test(next.value)) {
      return Match.Ok(scope, scope.withInput(next), next.value, regexPattern);
    }
  }

  return Match.Fail(scope, regexPattern);
}
