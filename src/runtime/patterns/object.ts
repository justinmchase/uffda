import { brightBlack, underline } from "std/fmt/colors.ts";
import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import { IObjectPattern, Pattern } from "./pattern.ts";

export function object(args: IObjectPattern, scope: Scope) {
  const { keys = {} } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (next.value && typeof next.value === "object") {
      let end = scope;
      const matches: Match[] = [];
      const objValue = next.value as Record<PropertyKey, unknown>;
      for (const [key, pattern] of Object.entries<Pattern>(keys)) {
        // The pattern will define whether or not its an error for this field to exist or not

        if (scope.options.trace) {
          const indent = "˃".padStart(scope.depth);
          console.log(`${indent} (${underline(brightBlack(key))})`);
        }

        const keyValue = objValue[key];
        const value = [keyValue];

        // console.log(Deno.inspect(value, { colors: true }))
        const propertyStream = new Input(
          value,
          next.path.push(key),
        );
        const propertyScope = end.withInput(propertyStream);
        const m = match(pattern, propertyScope);
        if (!m.matched) {
          // todo: Look for a better way to bubble up an error when an object is completely missing an expected property.
          // Possibly alter the definition of the `!` on the property to be handled in this pattern rather than just wrapping
          // it in a must pattern. Then throw an error explaining that the expected field is missing from the object.
          return m;
        }

        if (!m.end.stream.next().done) {
          return Match.Fail(scope, args, [m]);
        }

        end = end.addVariables(m.end.variables);
        matches.push(m);
      }
      return Match.Ok(scope, end.withInput(next), next.value, args, matches);
    } else {
      return Match.Fail(scope, args);
    }
  }
  return Match.Fail(scope, args);
}
