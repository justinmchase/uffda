import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IEqualPattern } from "./pattern.ts";

export function equal(args: IEqualPattern, scope: Scope): Match {
  const { value } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (next.value === value) {
      return Match.Ok(scope, scope.withInput(next), next.value, args);
    }
  }
  return Match.Fail(scope, args);
}
