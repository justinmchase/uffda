import { Comparable } from "../../comparable.ts";
import { error, fail, Match, MatchErrorCode, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IRangePattern } from "./pattern.ts";

export function range(pattern: IRangePattern, scope: Scope): Match {
  const { left, right } = pattern;
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  const end = scope.withInput(next);
  const { value } = next as { value: Comparable };
  if (value == null) {
    return error(
      scope,
      pattern,
      MatchErrorCode.NullValue,
      "expected value to be non-null",
    );
  }

  const tv = typeof value;
  const tl = typeof left;
  const tr = typeof right;
  if (tv !== tl || tv !== tr) {
    return fail(scope, pattern);
  }

  let inRange = false;
  if (typeof left === "object" && typeof right === "object") {
    if (
      typeof left.compareTo !== "function" ||
      typeof right.compareTo !== "function"
    ) {
      return fail(scope, pattern);
    }
    inRange = left.compareTo(value) >= 0 && right.compareTo(value) <= 0;
  } else {
    switch (tv) {
      case "string":
      case "number":
        inRange = left <= value && value <= right;
        break;
      default:
        return fail(scope, pattern);
    }
  }

  if (inRange) {
    return ok(scope, end, pattern, next.value);
  } else {
    return fail(scope, pattern);
  }
}
