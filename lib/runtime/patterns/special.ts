import { Scope } from "../../scope.ts";
import { Match } from "../../match.ts";
import { ISpecialPattern } from "./pattern.ts";

// Special values are $0 variables injected into the code using string templating.
// They are essentially global variables which can be used in various places in the DSL
// and may be expression values or patterns.
export function special(args: ISpecialPattern, scope: Scope): Match {
  const { name } = args;
  const special = scope.getSpecial(name);
  console.log(
    "special:",
    name,
    Deno.inspect(special, { colors: true, depth: 10 }),
  );
  // todo: error if special is undefined?
  return Match.Ok(scope, scope, special);
}
