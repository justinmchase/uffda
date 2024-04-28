import { Scope } from "../scope.ts";
import { Match } from "../../match.ts";
import { IReferencePattern } from "./pattern.ts";
import { rule } from "../rule.ts";

export function reference(pattern: IReferencePattern, scope: Scope): Match {
  const { name } = pattern;
  const ref = scope.getRule(name);
  if (ref) {
    const m = rule(ref, scope);
    if (m.isLr) {
      return m;
    } else if (m.matched) {
      return Match.Ok(m.start, m.end, m.value, pattern, [m]);
    } else {
      return Match.Fail(scope, pattern, [m]);
    }
  } else {
    return Match.Fail(scope, pattern);
  }
}
