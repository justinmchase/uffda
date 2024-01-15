import { Match } from "../match.ts";
import { Scope } from "./scope.ts";
import { rule } from "./rule.ts";

export function run(scope: Scope, patternName?: string): Match {
  const { module } = scope;

  // Main rule selection:
  // 1. If the caller specifies a pattern name, use that
  // 2. Look for a rule called Main
  // 3. Use the last rule in the module
  const main = patternName
    ? module.rules.get(patternName)
    : module.rules.has("Main")
    ? module.rules.get("Main")
    : [...module.rules.values()].slice(-1)[0];

  if (!main) {
    return Match.Fail(scope);
  }

  return rule(main, scope);
}
