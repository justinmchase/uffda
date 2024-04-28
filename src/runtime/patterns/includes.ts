import { Serializable } from "serializable/mod.ts";
import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IIncludesPattern } from "./pattern.ts";

export function includes(args: IIncludesPattern, scope: Scope) {
  const { values } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (values.includes(next.value as Serializable)) {
      return Match.Ok(scope, scope.withInput(next), next.value, args);
    }
  }
  return Match.Fail(scope, args);
}
