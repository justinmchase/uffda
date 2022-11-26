import { Match } from "../match.ts";
import { Scope } from "../scope.ts";
import { rule } from "./rule.ts";

export async function run(scope: Scope): Promise<Match> {
  const { module } = scope;
  const main = module.rules.has("Main")
    ? module.rules.get("Main")
    : [...module.rules.values()].slice(-1)[0]
    ;

  if (!main) {
    // todo: make a proper error...
    throw new Error('No rules defined')
  }

  return await rule(main, scope);
}