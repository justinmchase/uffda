import { Type, type } from "@justinmchase/type";
import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { compile } from "../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OverPattern } from "./pattern.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";

/** Compiles an `Over` pattern into a flattened, reusable closure. */
export function over(pattern: OverPattern, scope: Scope): CompiledPattern {
  const { keys = {} } = pattern;
  const children = Object.entries(keys).map(
    ([key, keyPattern]) =>
      [key, keyPattern, compile(keyPattern, scope)] as const,
  );
  return async (invocationScope: Scope) => {
    if (await invocationScope.stream.done()) {
      return fail(invocationScope, pattern);
    }

    const next = await invocationScope.stream.next();
    const [t] = type(next.value);

    // todo: handle maps as well...
    if (t !== Type.Object) {
      return error(
        invocationScope,
        pattern,
        MatchErrorCode.Type,
        `expected value to be an object but got type ${t}`,
      );
    }

    let last = invocationScope;
    const matches: Match[] = [];
    const objValue = next.value as Record<PropertyKey, unknown>;
    for (const [key, keyPattern, child] of children) {
      // The pattern will define whether or not its an error for this field to exist or not
      const keyValue = objValue[key];
      const value = [keyValue];
      const propertyStream = new Input(
        value,
        invocationScope.stream.path.push(key),
        0,
        undefined,
        InputNormalizationMode.Iterable,
      );
      const propertyScope = last.withInput(propertyStream);
      const m = await child(propertyScope);
      matches.push(m);

      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(invocationScope, keyPattern, matches);
        case MatchKind.Ok:
          last = m.scope;
          break;
      }
    }

    return ok(
      invocationScope,
      invocationScope.withInput(next).addVariables(last.variables),
      pattern,
      next.value,
      matches,
    );
  };
}
