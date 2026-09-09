import type { Serializable } from "@justinmchase/serializable";
import { fail, type Match, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { IncludesPattern } from "./pattern.ts";
import { resolveValueSource } from "./value_source.ts";

export function includes(pattern: IncludesPattern, scope: Scope): Match {
  const values: Serializable[] = [];
  for (const source of pattern.values) {
    const resolved = resolveValueSource(source, scope, pattern);
    if (resolved.kind === "error") {
      return resolved.match;
    }
    values.push(resolved.value as Serializable);
  }

  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  const end = scope.withInput(next);
  if (values.includes(next.value as Serializable)) {
    return ok(scope, end, pattern, next.value);
  } else {
    return fail(scope, pattern);
  }
}
