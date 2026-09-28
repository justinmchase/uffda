import { Type, type } from "@justinmchase/type";
import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { compile } from "../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OverPattern } from "./pattern.ts";
import { andThen, type AwaitableMatch, eachInOrder } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import { rawOf } from "../../wrapped.ts";

/** Compiles an `Over` pattern into a flattened, reusable closure. */
export function over(pattern: OverPattern, scope: Scope): CompiledPattern {
  const { keys = {} } = pattern;
  const children = Object.entries(keys).map(
    ([key, keyPattern]) =>
      [key, keyPattern, compile(keyPattern, scope)] as const,
  );
  return (invocationScope: Scope) =>
    andThen(invocationScope.stream.step(), (next): AwaitableMatch => {
      if (!next) {
        return fail(invocationScope, pattern);
      }
      const [t, raw] = type(rawOf(next.value));

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
      const objValue = raw as Record<PropertyKey, unknown>;
      return eachInOrder<Match, Match>(
        children.length,
        (i) => {
          const [key, , child] = children[i];
          // The pattern will define whether or not its an error for this field to exist or not.
          // A raw property of a host-supplied object takes the object's origin.
          const propertyStream = new Input(
            [objValue[key]],
            invocationScope.stream.path.push(key),
            0,
            undefined,
            InputNormalizationMode.Iterable,
            false,
            undefined,
            false,
            false,
            next.value?.origin,
          );
          return child(last.withInput(propertyStream));
        },
        (i, m) => {
          matches.push(m);
          switch (m.kind) {
            case MatchKind.LR:
            case MatchKind.Error:
              return m;
            case MatchKind.Fail:
              return fail(invocationScope, children[i][1], matches);
            case MatchKind.Ok:
              last = m.scope;
              return undefined;
          }
        },
        () =>
          ok(
            invocationScope,
            invocationScope.withInput(next).addVariables(last.variables),
            pattern,
            next.value,
            matches,
          ),
      );
    });
}
