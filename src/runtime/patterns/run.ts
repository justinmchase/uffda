import { error, MatchErrorCode } from "../../match.ts";
import { rule } from "../rule.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { RunPattern } from "./pattern.ts";

export function run(scope: Scope, pattern: RunPattern): Match {
  const { module } = scope;
  const { name } = pattern;

  // Main rule selection:
  // 1. If the caller specifies a pattern name, use that
  // 2. Use the default pattern
  const main = name ? module.exports.get(name) : module.default;

  if (!main) {
    return error(
      scope,
      pattern,
      MatchErrorCode.PatternExpected,
      name
        ? `Rule ${name} not found`
        : `Module does not have a default export, please specify which Rule you want to import`,
    );
  }

  return rule(main, new Map(), scope);
}
