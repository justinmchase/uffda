import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { characterClassToRegexp } from "./character.ts";
import { match } from "../match.ts";
import { resolveValueSource } from "./value_source.ts";
import { ValueSourceKind } from "./value_source.ts";
import type { Scope } from "../scope.ts";
import type { Pattern, SwitchKey, SwitchPattern } from "./pattern.ts";

type KeyCheck =
  | { ok: true; matched: boolean }
  | { ok: false; match: Match };

/**
 * Per-`SwitchPattern` cache of a literal-value → case-index map, used to
 * give O(1) dispatch for the common case where every case key is a fixed
 * set of literal values (no character classes, no variable-sourced
 * values). `null` means the pattern was checked and is *not* eligible
 * (linear committed-choice scan must be used instead — see
 * `buildLiteralCaseIndex` for why eligibility must be all-or-nothing).
 */
const literalCaseIndexCache = new WeakMap<
  SwitchPattern,
  Map<unknown, number> | null
>();

/**
 * Builds a literal-value → case-index map, but only when *every* case key
 * is `{kind:"values"}` composed entirely of `Literal` value sources. Any
 * `characterClass` key, or any `Variable`-sourced value, makes the whole
 * pattern ineligible: those keys can only be evaluated at match time (a
 * character class needs a regexp test; a variable needs the current
 * scope), so an earlier such case could "win" over a later literal case
 * that a map lookup would otherwise jump straight to. Requiring full
 * eligibility keeps the committed-choice, declared-order semantics exact
 * while still giving real O(1) lookups for the common fully-literal
 * `switch`.
 */
function buildLiteralCaseIndex(
  pattern: SwitchPattern,
): Map<unknown, number> | null {
  const map = new Map<unknown, number>();
  for (let i = 0; i < pattern.cases.length; i++) {
    const key = pattern.cases[i].key;
    if (key.kind !== "values") {
      return null;
    }
    for (const source of key.values) {
      if (source.kind !== ValueSourceKind.Literal) {
        return null;
      }
      // First case in declared order to claim a given literal value wins.
      if (!map.has(source.value)) {
        map.set(source.value, i);
      }
    }
  }
  return map;
}

function getLiteralCaseIndex(
  pattern: SwitchPattern,
): Map<unknown, number> | null {
  let cached = literalCaseIndexCache.get(pattern);
  if (cached === undefined) {
    cached = buildLiteralCaseIndex(pattern);
    literalCaseIndexCache.set(pattern, cached);
  }
  return cached;
}

/**
 * Evaluates one declared, author-written `key` directly against the peeked
 * `value` — never against the case's own body pattern. See `SwitchPattern`
 * for why this sidesteps the soundness pitfalls of inferring a FIRST-set
 * from an arbitrary pattern.
 */
function keyMatches(
  key: SwitchKey,
  value: unknown,
  isEof: boolean,
  scope: Scope,
  pattern: Pattern,
): KeyCheck {
  if (isEof) {
    return { ok: true, matched: false };
  }
  switch (key.kind) {
    case "values": {
      for (const source of key.values) {
        const resolved = resolveValueSource(source, scope, pattern);
        if (resolved.kind === "error") {
          return { ok: false, match: resolved.match };
        }
        if (resolved.value === value) {
          return { ok: true, matched: true };
        }
      }
      return { ok: true, matched: false };
    }
    case "characterClass": {
      const regexp = characterClassToRegexp(key.characterClass);
      if (!regexp) {
        return {
          ok: false,
          match: error(
            scope,
            pattern,
            MatchErrorCode.InvalidArgument,
            `unknown character class ${key.characterClass}`,
          ),
        };
      }
      return {
        ok: true,
        matched: typeof value === "string" && regexp.test(value),
      };
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

function wrap(scope: Scope, pattern: SwitchPattern, m: Match): Match {
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(scope, m.scope, pattern, m.value, [m]);
  }
}

/**
 * Committed-choice dispatch (see `SwitchPattern`): peek the next stream
 * value once, run only the first case whose declared `key` matches it, and
 * return that case's result directly — a failing chosen case does *not*
 * fall through to try any other case, unlike `Or`.
 */
export async function switchPattern(
  pattern: SwitchPattern,
  scope: Scope,
): Promise<Match> {
  const isEof = await scope.stream.done();
  const value = isEof ? undefined : (await scope.stream.next()).value;

  if (!isEof) {
    const literalIndex = getLiteralCaseIndex(pattern);
    if (literalIndex) {
      // O(1) fast path: every key is a fixed set of literals, so a single
      // Map lookup tells us the (only possible) matching case, if any.
      const i = literalIndex.get(value);
      if (i !== undefined) {
        return wrap(
          scope,
          pattern,
          await match(pattern.cases[i].pattern, scope),
        );
      }
      if (pattern.default) {
        return wrap(scope, pattern, await match(pattern.default, scope));
      }
      return fail(scope, pattern);
    }
  }

  for (const c of pattern.cases) {
    const result = keyMatches(c.key, value, isEof, scope, pattern);
    if (!result.ok) {
      return result.match;
    }
    if (result.matched) {
      return wrap(scope, pattern, await match(c.pattern, scope));
    }
  }

  if (pattern.default) {
    return wrap(scope, pattern, await match(pattern.default, scope));
  }

  return fail(scope, pattern);
}
