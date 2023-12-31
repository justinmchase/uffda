import { Match, MatchError } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { ISlicePattern } from "./pattern.ts";

export function slice(args: ISlicePattern, scope: Scope) {
  const { min, max, pattern } = args;
  if (min != null) {
    if (min < 0) throw new Error(`min must be 0 or greater but is ${min}`);
    if (isNaN(min)) throw new Error(`min must be a number but is NaN`);
    if ((min % 1) !== 0) {
      throw new Error(`min must be an integer but is ${min}`);
    }
  }

  if (max != null) {
    if (max < 0) throw new Error(`max must be 0 or greater but is ${max}`);
    if (min != null && max < min) {
      throw new Error(
        `max must be greater than or equal to min but is ${max} < ${min}`,
      );
    }
    if (isNaN(max)) throw new Error(`max must be a number but is NaN`);
    if (max !== Number.POSITIVE_INFINITY && (max % 1) !== 0) {
      throw new Error(`max must be an integer but is ${max}`);
    }
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
