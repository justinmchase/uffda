import { fail, type Match, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile, match } from "../match.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { ThenPattern } from "./pattern.ts";

export async function then(pattern: ThenPattern, scope: Scope): Promise<Match> {
  const { patterns } = pattern;
  let end = scope;
  const matches: Match[] = [];
  const values: unknown[] = [];
  for (const pattern of patterns) {
    const m = await match(pattern, end);
    matches.push(m);

    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, pattern, matches);
      case MatchKind.Ok:
        values.push(m.value);
        end = m.scope;
        break;
    }
  }

  return ok(scope, end, pattern, values, matches);
}

/** Compiles a `Then` pattern into a flattened, reusable closure. */
export function buildThen(pattern: ThenPattern): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map(compile);
  return async (scope: Scope) => {
    let end = scope;
    const matches: Match[] = [];
    const values: unknown[] = [];
    for (let i = 0; i < children.length; i++) {
      const m = await children[i](end);
      matches.push(m);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(scope, patterns[i], matches);
        case MatchKind.Ok:
          values.push(m.value);
          end = m.scope;
          break;
      }
    }
    return ok(scope, end, pattern, values, matches);
  };
}
