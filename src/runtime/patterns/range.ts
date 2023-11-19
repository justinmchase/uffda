import { Comparable } from "../../comparable.ts";
import { Match } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IRangePattern } from "./pattern.ts";

export function range(args: IRangePattern, scope: Scope): Match {
  const { left, right } = args;
  if (!scope.stream.done) {
    const next = scope.stream.next();
    const { value } = next as { value: Comparable };
    if (value == null) {
      return Match.Fail(scope).pushError(
        "InvalidType",
        `Range cannot compare null or undefined value`,
        scope,
        scope,
      );
    }

    const tv = typeof value;
    const tl = typeof left;
    const tr = typeof right;
    if (tv !== tl) {
      return Match.Fail(scope).pushError(
        "InvalidType",
        `Range cannot compare type ${tv} to left type ${tl}`,
        scope,
        scope,
      );
    }
    if (tv !== tr) {
      return Match.Fail(scope).pushError(
        "InvalidType",
        `Range cannot compare type ${tv} to right type ${tr}`,
        scope,
        scope,
      );
    }

    let inRange = false;
    if (typeof left === "object" && typeof right === "object") {
      if (typeof left.compareTo !== "function") {
        return Match.Fail(scope).pushError(
          "InvalidType",
          `Range cannot compare left object without a compareTo function`,
          scope,
          scope,
        );
      }
      if (typeof right.compareTo !== "function") {
        return Match.Fail(scope).pushError(
          "InvalidType",
          `Range cannot compare right object without a compareTo function`,
          scope,
          scope,
        );
      }

      inRange = left.compareTo(value) >= 0 && right.compareTo(value) <= 0;
    } else {
      switch (tv) {
        case "string":
        case "number":
          inRange = left <= value && value <= right;
          break;
        default:
          return Match.Fail(scope).pushError(
            "InvalidType",
            `Range cannot compare value of type ${tv}`,
            scope,
            scope,
          );
      }
    }

    if (inRange) {
      return Match.Ok(scope, scope.withInput(next), next.value);
    }
  }

  return Match.Fail(scope);
}
