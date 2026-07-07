import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { match } from "../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { QuantifierPattern } from "./pattern.ts";

export async function quantifier(
  pattern: QuantifierPattern,
  scope: Scope,
): Promise<Match> {
  const { min, max } = pattern;
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
  while (!done && !end.stream.done) {
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
