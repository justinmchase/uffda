import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { characterClassToRegexp } from "./character.ts";
import { compile } from "../match.ts";
import { resolveValueSource } from "./value_source.ts";
import { ValueSourceKind } from "./value_source.ts";
import type { Scope } from "../scope.ts";
import type { Pattern, SwitchKey, SwitchPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

type KeyCheck =
  | { ok: true; matched: boolean }
  | { ok: false; match: Match };

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
 * `switch`. Computed once at build time (see {@link buildSwitch}) and
 * closed over by the returned closure, rather than cached separately.
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
      // Match the standalone `character` pattern's contract: a non-string
      // current item is a type error, not merely a non-matching key, so a
      // `characterClass` key check must not silently mask it as "try the
      // next case/default".
      if (typeof value !== "string") {
        return {
          ok: false,
          match: error(
            scope,
            pattern,
            MatchErrorCode.Type,
            `expected value to be a string but got ${typeof value}`,
          ),
        };
      }
      return {
        ok: true,
        matched: regexp.test(value),
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
 * Compiles a `Switch` pattern into a flattened, reusable closure.
 * Committed-choice dispatch (see `SwitchPattern`): peek the next stream
 * value once, run only the first case whose declared `key` matches it, and
 * return that case's result directly — a failing chosen case does *not*
 * fall through to try any other case, unlike `Or`. The literal-value
 * dispatch map (when eligible) and every case/default child are compiled
 * exactly once here, not recomputed per invocation.
 */
export function switchPattern(
  pattern: SwitchPattern,
  scope: Scope,
): CompiledPattern {
  const literalIndex = buildLiteralCaseIndex(pattern);
  const caseChildren = pattern.cases.map((c) => compile(c.pattern, scope));
  const defaultChild = pattern.default
    ? compile(pattern.default, scope)
    : undefined;
  return async (invocationScope: Scope) => {
    const isEof = await invocationScope.stream.done();
    const value = isEof
      ? undefined
      : (await invocationScope.stream.next()).value;

    if (!isEof && literalIndex) {
      // O(1) fast path: every key is a fixed set of literals, so a single
      // Map lookup tells us the (only possible) matching case, if any.
      const i = literalIndex.get(value);
      if (i !== undefined) {
        return wrap(
          invocationScope,
          pattern,
          await caseChildren[i](invocationScope),
        );
      }
      if (defaultChild) {
        return wrap(
          invocationScope,
          pattern,
          await defaultChild(invocationScope),
        );
      }
      return fail(invocationScope, pattern);
    }

    for (let i = 0; i < pattern.cases.length; i++) {
      const result = keyMatches(
        pattern.cases[i].key,
        value,
        isEof,
        invocationScope,
        pattern,
      );
      if (!result.ok) {
        return result.match;
      }
      if (result.matched) {
        return wrap(
          invocationScope,
          pattern,
          await caseChildren[i](invocationScope),
        );
      }
    }

    if (defaultChild) {
      return wrap(
        invocationScope,
        pattern,
        await defaultChild(invocationScope),
      );
    }

    return fail(invocationScope, pattern);
  };
}
