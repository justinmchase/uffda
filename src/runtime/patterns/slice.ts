import {
  error,
  fail,
  Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { ISlicePattern } from "./pattern.ts";

export function slice(pattern: ISlicePattern, scope: Scope) {
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
    const m = match(pattern.pattern, end);
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

    // This prevents infinite recursion for Patterns which succeed
    // but consume no input, such as `not` or `ok`
    //
    // For example (!any)* or ok+
    //
    // This will consume no input but it will succeed
    if (m.scope.stream.path.compareTo(end.stream.path) <= 0) {
      // If we've specified a minimum, then match at least that many times
      // before breaking, else match once then break
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
