import { PatternKind } from "./patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import type { Pattern } from "./patterns/pattern.ts";
import type { Rule } from "./modules/rule.ts";
import { SpecialKind } from "./modules/special.ts";
import { isFunc } from "./modules/func.ts";

/**
 * Static, conservative call-graph analysis used to decide whether a rule's
 * invocation can skip packrat memoization entirely (see
 * `.agents/specifications/runtime/selective-memoization.spec.md`).
 * Profiling `morse.uff`'s compile showed many high-volume rules (e.g.
 * `NormalizedUnit`, `Letter`, `Whitespace`) sit at an exact 0% memo hit
 * rate — each is visited exactly once per input position and never
 * re-entered — so the `Memos.resolve`/`set` bookkeeping they pay on every
 * single call is pure overhead with no cache-hit payoff.
 *
 * A rule is safe to skip memoization for if and only if it can be *proven*,
 * from static structure alone, that it can never be re-entered at the same
 * input position:
 *   - it takes no parameters (parameterized/generic rules are used in ways
 *     this analysis does not attempt to reason about), and
 *   - every call it can statically make resolves to a concrete `Rule`
 *     (no `resolve.run`, no argument-passing calls, no unresolved names),
 *     and
 *   - it is not reachable from itself through those calls (i.e. it does
 *     not participate in any call cycle, directly or mutually recursive).
 *
 * Anything this analysis cannot prove is treated conservatively as
 * "must memoize" — this is a correctness-preserving optimization, not a
 * best-effort heuristic: it never skips memoization for a rule that might
 * actually need it.
 */

type CalleeInfo = {
  /** True if any call site could not be statically resolved to a single,
   * fixed `Rule` (parameterized rule, `resolve.run`, argument-passing call,
   * unresolved name, or a module's dynamically-selected default export). */
  dynamic: boolean;
  callees: Rule[];
};

const calleeCache = new WeakMap<Rule, CalleeInfo>();
const skipMemoCache = new WeakMap<Rule, boolean>();

function childPatterns(pattern: Pattern): Pattern[] {
  switch (pattern.kind) {
    case PatternKind.Any:
    case PatternKind.Between:
    case PatternKind.Character:
    case PatternKind.End:
    case PatternKind.Equal:
    case PatternKind.Fail:
    case PatternKind.Includes:
    case PatternKind.Ok:
    case PatternKind.RegExp:
    case PatternKind.Type:
      return [];
    case PatternKind.And:
    case PatternKind.Or:
    case PatternKind.Then:
      return pattern.patterns;
    case PatternKind.Pipeline:
      return pattern.steps;
    case PatternKind.Except:
    case PatternKind.Into:
    case PatternKind.Lookahead:
    case PatternKind.Maybe:
    case PatternKind.Not:
    case PatternKind.Projection:
    case PatternKind.Quantifier:
    case PatternKind.Variable:
      return [pattern.pattern];
    case PatternKind.Over:
      return Object.values(pattern.keys ?? {});
    case PatternKind.Switch:
      return pattern.default
        ? [...pattern.cases.map((c) => c.pattern), pattern.default]
        : pattern.cases.map((c) => c.pattern);
    case PatternKind.Resolve:
      // Resolve edges are handled specially by the caller (they are call
      // sites, not structural children); args are only structural for
      // resolve.reference and are visited there.
      return pattern.targetKind === ResolveTargetKind.Reference
        ? pattern.args
        : [];
  }
}

function calleesOf(rule: Rule): CalleeInfo {
  const cached = calleeCache.get(rule);
  if (cached) return cached;

  const callees: Rule[] = [];
  let dynamic = rule.parameters.length > 0;

  const visit = (pattern: Pattern): void => {
    if (dynamic) return;
    if (pattern.kind === PatternKind.Resolve) {
      switch (pattern.targetKind) {
        case ResolveTargetKind.Reference: {
          if (pattern.args.length > 0) {
            // Passing rule-valued arguments makes the callee's own behavior
            // depend on this call site; not analyzed, treated as unknown.
            dynamic = true;
            return;
          }
          const target = rule.module.rules.get(pattern.name) ??
            rule.module.imports.get(pattern.name);
          if (!target) {
            dynamic = true;
            return;
          }
          if (!isFunc(target)) callees.push(target);
          return;
        }
        case ResolveTargetKind.Run:
          // Runs a module's default export, which is only known once the
          // target module's declarations are fully resolved; not analyzed.
          dynamic = true;
          return;
        case ResolveTargetKind.Special: {
          const { value } = pattern;
          if (value == null || typeof value === "function") {
            dynamic = true;
            return;
          }
          if (value.kind === SpecialKind.Rule) {
            callees.push(value.rule);
          } else {
            dynamic = true;
          }
          return;
        }
      }
    }
    for (const child of childPatterns(pattern)) visit(child);
  };

  visit(rule.pattern);

  const info: CalleeInfo = { dynamic, callees };
  calleeCache.set(rule, info);
  return info;
}

/**
 * True if `target` is reachable from `start` through statically-resolved
 * call edges, or if any rule reached along the way has unresolved
 * ("dynamic") calls whose targets could not be ruled out.
 */
function reaches(start: Rule, target: Rule, visiting: Set<Rule>): boolean {
  if (visiting.has(start)) return false;
  visiting.add(start);

  const { dynamic, callees } = calleesOf(start);
  if (dynamic) return true;

  for (const callee of callees) {
    if (callee === target) return true;
    if (reaches(callee, target, visiting)) return true;
  }
  return false;
}

/**
 * Whether `rule`'s invocation can safely skip packrat memoization because
 * it is provably never re-enterable at the same input position.
 *
 * Note this only concerns a *single* parse's in-progress backtracking/
 * left-recursion re-entry. It is orthogonal to
 * `.agents/specifications/runtime/incremental-parsing.spec.md`'s reuse
 * mechanism: a skip-memo rule's invocations still carry a `MatchOrigin`
 * (see `rule()` in `./rule.ts`), but since the rule never consults
 * `scope.memos`, a rehydrated entry for it is simply never looked up — the
 * rule is always recomputed directly on a rehydrated re-parse instead of
 * reused by identity. That is safe (incremental re-parsing's own contract
 * treats reuse gaps as a performance-only concern, never a correctness
 * one) and is not a real loss in practice: a rule this analysis proves safe
 * to skip is, by construction, cheap and non-recursive, so recomputing it
 * directly costs about what a memo lookup would have anyway.
 */
export function canSkipMemo(rule: Rule): boolean {
  const cached = skipMemoCache.get(rule);
  if (cached !== undefined) return cached;

  const { dynamic, callees } = calleesOf(rule);
  let safe = !dynamic;
  if (safe) {
    for (const callee of callees) {
      if (callee === rule || reaches(callee, rule, new Set())) {
        safe = false;
        break;
      }
    }
  }

  skipMemoCache.set(rule, safe);
  return safe;
}
