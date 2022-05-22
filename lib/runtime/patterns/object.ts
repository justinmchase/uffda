import { Match, MatchError } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { MetaStream } from "../../stream.ts";
import { match } from "../match.ts";
import { IObjectPattern, Pattern } from "./pattern.ts";

export function object(args: IObjectPattern, scope: Scope) {
  const { keys = {} } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (next.value && typeof next.value === "object") {
      let end = scope;
      const errors: MatchError[] = [];
      const objValue = next.value as Record<PropertyKey, unknown>;
      for (
        const [key, pattern] of Object.entries(keys) as [string, Pattern][]
      ) {
        // The pattern will define whether or not its an error for this field to exist or not

        const keyValue = objValue[key];
        const value = [keyValue];

        // console.log(Deno.inspect(value, { colors: true }))
        const propertyStream = new MetaStream(
          next.path.add(key),
          value[Symbol.iterator](),
        );
        const propertyScope = end.withStream(propertyStream);
        const m = match(pattern, propertyScope);
        errors.push(...m.errors);

        if (!m.matched) {
          return m;
        }

        if (!m.end.stream.next().done) {
          return Match.Incomplete(m.start, m.end, m.value, errors);
        }

        end = end.addVariables(m.end.variables);
      }
      return Match.Ok(scope, end.withStream(next), next.value, errors);
    }
  }
  return Match.Fail(scope);
}
