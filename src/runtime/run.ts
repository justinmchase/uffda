import { Match } from "../match.ts";
import { Scope } from "../scope.ts";
import { rule } from "./rule.ts";

export function run(scope: Scope): Match {
  const { module } = scope;
  const main = module.rules.has("Main")
    ? module.rules.get("Main")
    : [...module.rules.values()].slice(-1)[0];

  if (!main) {
    // todo: make a proper error...
    return Match.Fail(scope).pushError(
      "E_EMPTY_MODULE",
      `A module with no rules was run (${module.moduleUrl})`,
      scope,
      scope,
    );
  }

  return rule(main, scope);
}
