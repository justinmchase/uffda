import type { Scope } from "../scope.ts";
import { fail, MatchKind, type MatchOk, ok } from "../../match.ts";
import { compile } from "../match.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { AndPattern } from "./pattern.ts";

/** Compiles an `And` pattern into a flattened, reusable closure. */
export function and(pattern: AndPattern, scope: Scope): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map((p) => compile(p, scope));
  return async (invocationScope: Scope) => {
    let s = invocationScope;
    const matches: MatchOk[] = [];
    for (let i = 0; i < children.length; i++) {
      const m = await children[i](s);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(invocationScope, patterns[i], [...matches, m]);
        case MatchKind.Ok:
          matches.push(m);
          s = s.addVariables(m.scope.variables);
          break;
      }
    }
    const last = matches.slice(-1)?.[0];
    return ok(s, last?.scope ?? s, pattern, last?.value, matches);
  };
}
