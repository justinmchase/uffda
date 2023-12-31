import { Match } from "../match.ts";
import { Scope } from "./scope.ts";
import { rule } from "./rule.ts";

export function run(scope: Scope, patternName?: string): Match {
  const { module } = scope;
  const main = patternName
    ? module.rules.get(patternName)
    : (module.rules.get("Main") ?? [...module.rules.values()].slice(-1)[0]);

  if (!main) {
    if (!module.rules.size) {
      // todo: make a proper error...
      return Match.Fail(scope).pushError(
        "E_EMPTY_MODULE",
        `A module with no rules was run (${module.moduleUrl.href})`,
        scope,
        scope,
      );
    } else {
      return Match.Fail(scope).pushError(
        "E_MODULE_MAIN",
        `A module (${module.moduleUrl.href}) does not contain main rule [${
          patternName ?? "Main"
        }]`,
        scope,
        scope,
      );
    }
  }

  return rule(main, scope);
}
