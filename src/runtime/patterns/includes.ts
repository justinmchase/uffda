import type { Serializable } from "@justinmchase/serializable";
import { fail, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { IncludesPattern } from "./pattern.ts";
import { resolveValueSource } from "./value_source.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Matches an `Includes` pattern: the interpreted entry point delegates to
 * the same logic as {@link buildIncludes}, so there is a single
 * implementation. */
export function includes(
  pattern: IncludesPattern,
  scope: Scope,
): AwaitableMatch {
  return buildIncludes(pattern)(scope);
}

/** Compiles an `Includes` pattern into a flattened, reusable closure. */
export function buildIncludes(pattern: IncludesPattern): CompiledPattern {
  return async (scope: Scope) => {
    const values: Serializable[] = [];
    for (const source of pattern.values) {
      const resolved = resolveValueSource(source, scope, pattern);
      if (resolved.kind === "error") {
        return resolved.match;
      }
      values.push(resolved.value as Serializable);
    }

    if (await scope.stream.done()) {
      return fail(scope, pattern);
    }

    const next = await scope.stream.next();
    const end = scope.withInput(next);
    if (values.includes(next.value as Serializable)) {
      return ok(scope, end, pattern, next.value);
    } else {
      return fail(scope, pattern);
    }
  };
}
