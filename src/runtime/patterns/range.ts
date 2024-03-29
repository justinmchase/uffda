import { Comparable } from "../../comparable.ts";
import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IRangePattern } from "./pattern.ts";

export function range(pattern: IRangePattern, scope: Scope): Match {
  const { left, right } = pattern;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    const { value } = next as { value: Comparable };
    if (value == null) {
      return Match.Fail(scope);
    }

    const tv = typeof value;
    const tl = typeof left;
    const tr = typeof right;
    if (tv !== tl) {
      return Match.Fail(scope);
    }
    if (tv !== tr) {
      return Match.Fail(scope);
    }

    let inRange = false;
    if (typeof left === "object" && typeof right === "object") {
      if (typeof left.compareTo !== "function") {
        return Match.Fail(scope);
      }
      if (typeof right.compareTo !== "function") {
        return Match.Fail(scope);
      }

      inRange = left.compareTo(value) >= 0 && right.compareTo(value) <= 0;
    } else {
      switch (tv) {
        case "string":
        case "number":
          inRange = left <= value && value <= right;
          break;
        default:
          return Match.Fail(scope);
      }
    }

    if (inRange) {
      return Match.Ok(scope, scope.withInput(next), next.value);
    } else {
      return Match.Fail(scope);
    }
  }

  return Match.Fail(scope);
}
