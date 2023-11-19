import { black } from "std/fmt/colors.ts";
import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { IEqualPattern } from "./pattern.ts";

export function equal(args: IEqualPattern, scope: Scope): Match {
  const { value } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();

    if (scope.options.trace) {
      const indent = "›".padStart(scope.depth);
      console.log(
        `${indent} [${
          black(`${Deno.inspect(next.value)} === ${Deno.inspect(value)}`)
        }]`,
      );
    }

    if (next.value === value) {
      return Match.Ok(scope, scope.withInput(next), next.value);
    }
  }

  return Match.Fail(scope);
}
