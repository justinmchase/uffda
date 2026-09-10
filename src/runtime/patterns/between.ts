import { error, fail, MatchErrorCode, ok } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Comparable } from "../../comparable.ts";
import type { Scope } from "../scope.ts";
import type { BetweenPattern } from "./pattern.ts";
import { resolveValueSource } from "./value_source.ts";

export function between(pattern: BetweenPattern, scope: Scope): Match {
  if (pattern.left == null && pattern.right == null) {
    return error(
      scope,
      pattern,
      MatchErrorCode.InvalidArgument,
      "between requires at least one bound (L..R, L.., or ..R)",
    );
  }

  let left: Comparable | undefined;
  if (pattern.left != null) {
    const leftResolved = resolveValueSource(pattern.left, scope, pattern);
    if (leftResolved.kind === "error") {
      return leftResolved.match;
    }
    left = leftResolved.value as Comparable;
  }

  let right: Comparable | undefined;
  if (pattern.right != null) {
    const rightResolved = resolveValueSource(pattern.right, scope, pattern);
    if (rightResolved.kind === "error") {
      return rightResolved.match;
    }
    right = rightResolved.value as Comparable;
  }

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
  if (left != null && tv !== typeof left) {
    return fail(scope, pattern);
  }
  if (right != null && tv !== typeof right) {
    return fail(scope, pattern);
  }

  let inRange = false;
  if (tv === "object") {
    if (left != null) {
      if (typeof left !== "object" || typeof left.compareTo !== "function") {
        return fail(scope, pattern);
      }
    }
    if (right != null) {
      if (
        typeof right !== "object" ||
        typeof right.compareTo !== "function"
      ) {
        return fail(scope, pattern);
      }
    }
    const aboveLeft = left == null || left.compareTo(value) >= 0;
    const belowRight = right == null || right.compareTo(value) <= 0;
    inRange = aboveLeft && belowRight;
  } else {
    switch (tv) {
      case "string":
      case "number": {
        const aboveLeft = left == null || left <= value;
        const belowRight = right == null || value <= right;
        inRange = aboveLeft && belowRight;
        break;
      }
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
