import { error, Match, MatchErrorCode } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IRunPattern } from "./pattern.ts";
import { rule } from "../rule.ts";

export function run(scope: Scope, pattern: IRunPattern): Match {
  const { module } = scope;
  const { name = "Main" } = pattern;

  // Main rule selection:
  // 1. If the caller specifies a pattern name, use that
  // 2. Look for a rule called Main
  // 3. Use the last rule in the module
  const main = module.rules.has(name)
    ? module.rules.get(name)
    : [...module.rules.values()].slice(-1)[0];

  if (!main) {
    return error(
      scope,
      pattern,
      MatchErrorCode.PatternExpected,
      `Rule ${name} not found`,
    );
  }

  return rule(main, scope);
}
