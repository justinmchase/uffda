import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import type { Func } from "../modules/func.ts";

export type FuncCallable = (...args: unknown[]) => Promise<unknown>;

/**
 * Wrap a module func as an ordinary callable. Arguments bind positionally to
 * declared parameter names; the body runs via `exec` in a child variable scope.
 */
export function funcCallable(fn: Func, match: MatchOk): FuncCallable {
  return async (...args: unknown[]) => {
    if (args.length !== fn.parameters.length) {
      throw new Error(
        `func ${fn.name} expected ${fn.parameters.length} argument(s), got ${args.length}`,
      );
    }
    const bound: Record<string, unknown> = {};
    for (let i = 0; i < fn.parameters.length; i++) {
      bound[fn.parameters[i].name] = args[i];
    }
    const scope = match.scope.addVariables(bound);
    return await exec(fn.expression, { ...match, scope });
  };
}
