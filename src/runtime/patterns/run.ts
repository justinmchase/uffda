import { error, MatchErrorCode } from "../../match.ts";
import { rule } from "../rule.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { RunPattern } from "./pattern.ts";

export function run(scope: Scope, pattern: RunPattern): Match {
  const { module } = scope;
  const { name = "Main" } = pattern;

  // Main rule selection:
  // 1. If the caller specifies a pattern name, use that
  // 2. Look for a rule called Main
  // 3. Use the last rule in the module
  const main = module.exports.has(name)
    ? module.exports.get(name)
    : [...module.exports.values()].slice(-1)[0];

  if (!main) {
    return error(
      scope,
      pattern,
      MatchErrorCode.PatternExpected,
      `Rule ${name} not found`,
    );
  }

  return rule(main, new Map(), scope);
}
