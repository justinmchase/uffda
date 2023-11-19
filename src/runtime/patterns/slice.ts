import { assert } from "std/testing/asserts.ts";
import { Match, MatchError } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { ISlicePattern } from "./pattern.ts";

export function slice(args: ISlicePattern, scope: Scope) {
  const { min, max, pattern } = args;
  if (min != null) {
    assert(min >= 0, `min must be 0 or greater but is ${min}`);
    assert((min % 1) === 0, `min must be an integer but is ${min}`);
  }

  if (max != null) {
    assert(max >= 0, `max must be 0 or greater but is ${max}`);
    assert((max % 1) === 0, `max must be an integer but is ${max}`);
  }

  if (scope.options.trace) {
    const indent = `[`.padStart(scope.depth);
    console.log(`${indent} ${min ?? ""}:${max ?? ""} ]`);
  }

  let end: Scope = scope;
  const matches: unknown[] = [];
  const errors: MatchError[] = [];
  while (true) {
    const m = match(pattern, end);

    // The pattern must match successfully
    if (!m.matched) {
      break;
    }

    errors.push(...m.errors);

    // This prevents infinite recursion for Patterns which succeed
    // but consume no input, such as `not` or `ok`
    //
    // For example (!any)* or ok+
    //
    // This will consume no input but it will succeed
    if (m.end.stream.path.compareTo(end.stream.path) <= 0) {
      break;
    }

    end = m.end;
    matches.push(m.value);
    if (max != null && matches.length >= max) {
      break;
    }
  }

  if (!min || matches.length >= min) {
    return Match.Ok(scope, end, matches, errors);
  } else {
    return Match.Fail(scope);
  }
}
