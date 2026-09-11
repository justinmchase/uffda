import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { match } from "../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { QuantifierPattern } from "./pattern.ts";
import { resolveValueSource, type ValueSource } from "./value_source.ts";

function resolveBound(
  bound: ValueSource | undefined,
  scope: Scope,
  pattern: QuantifierPattern,
): { kind: "ok"; value: number | undefined } | { kind: "error"; match: Match } {
  if (bound == null) {
    return { kind: "ok", value: undefined };
  }
  const resolved = resolveValueSource(bound, scope, pattern);
  if (resolved.kind === "error") {
    return resolved;
  }
  return { kind: "ok", value: resolved.value as number };
}

export async function quantifier(
  pattern: QuantifierPattern,
  scope: Scope,
): Promise<Match> {
  const minResolved = resolveBound(pattern.min, scope, pattern);
  if (minResolved.kind === "error") {
    return minResolved.match;
  }
  const maxResolved = resolveBound(pattern.max, scope, pattern);
  if (maxResolved.kind === "error") {
    return maxResolved.match;
  }
  const min = minResolved.value;
  const max = maxResolved.value;

  if (min != null) {
    if (min < 0) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `min must be 0 or greater but is ${min}`,
      );
    }
    if (isNaN(min)) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `min must be a number but is NaN`,
      );
    }
    if ((min % 1) !== 0) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `min must be an integer but is ${min}`,
      );
    }
  }

  if (max != null) {
    if (max < 0) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `max must be 0 or greater but is ${max}`,
      );
    }
    if (min != null && max < min) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `max must be greater than or equal to min but is ${max} < ${min}`,
      );
    }
    if (isNaN(max)) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `max must be a number but is NaN`,
      );
    }
    if (max !== Number.POSITIVE_INFINITY && (max % 1) !== 0) {
      return error(
        scope,
        pattern,
        MatchErrorCode.InvalidArgument,
        `max must be an integer but is ${max}`,
      );
    }
  }

  let end: Scope = scope;
  const values: unknown[] = [];
  const matches: Match[] = [];
  let done = false;
  while (!done && !(await end.stream.done())) {
    const m = await match(pattern.pattern, end);
    matches.push(m);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        done = true;
        break;
      case MatchKind.Ok:
        values.push(m.value);
        break;
    }

    // Prevent infinite loops on patterns that succeed without consuming input.
    if (m.scope.stream.path.compareTo(end.stream.path) <= 0) {
      if (values.length >= (min ? min : 1)) {
        break;
      }
    }

    end = m.scope;
    if (max != null && values.length >= max) {
      done = true;
      break;
    }
  }

  if (!min || values.length >= min) {
    return ok(scope, end, pattern, values, matches);
  } else {
    return fail(scope, pattern, matches);
  }
}
