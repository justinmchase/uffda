import type { Serializable } from "@justinmchase/serializable";
import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { IncludesPattern } from "./pattern.ts";
import { resolveValueSource } from "./value_source.ts";
import { andThen } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `Includes` pattern into a flattened, reusable closure. */
export function includes(pattern: IncludesPattern): CompiledPattern {
  return (scope: Scope) => {
    const values: Serializable[] = [];
    for (const source of pattern.values) {
      const resolved = resolveValueSource(source, scope, pattern);
      if (resolved.kind === "error") {
        return resolved.match;
      }
      values.push(resolved.value as Serializable);
    }

    return andThen(scope.stream.step(), (next) => {
      if (!next || !values.includes(next.value as Serializable)) {
        return fail(scope, pattern);
      }
      return ok(scope, scope.withInput(next), pattern, next.value);
    });
  };
}
