import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";

export enum ValueType {
  String = "string",
  Number = "number",
  BigInt = "bigint",
  Boolean = "boolean",
  Symbol = "symbol",
  Undefined = "undefined",
  Object = "object",
  Function = "function",
}

export function type(type: ValueType, scope: Scope): Match {
  if (!scope.stream.done) {
    const end = scope.stream.next();
    const t = typeof end.value;
    if (t === type) {
      return Match.Ok(scope, scope.withStream(end), end.value);
    }
  }
  return Match.Fail(scope);
}
