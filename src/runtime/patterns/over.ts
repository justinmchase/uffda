import { Type, type } from "@justinmchase/type";
import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { compile } from "../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OverPattern, Pattern } from "./pattern.ts";
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
  const restChildren = pattern.rest
    ? {
      key: compile(pattern.rest.key, scope),
      value: compile(pattern.rest.value, scope),
    }
    : undefined;
  return (invocationScope: Scope) =>
    andThen(invocationScope.stream.step(), (next): AwaitableMatch => {
      if (!next) {
        return fail(invocationScope, pattern);
      }
      const [t, raw] = type(rawOf(next.value));

      if (t !== Type.Object && t !== Type.Map) {
        return error(
          invocationScope,
          pattern,
          MatchErrorCode.Type,
          `expected value to be an object or Map but got type ${t}`,
        );
      }

      let last = invocationScope;
      const matches: Match[] = [];
      const steps: {
        pattern: Pattern;
        child: CompiledPattern;
        value: unknown;
        path: Input["path"];
      }[] = [];
      const mapValue = t === Type.Map
        ? raw as Map<unknown, unknown>
        : undefined;
      const objValue = t === Type.Object
        ? raw as Record<PropertyKey, unknown>
        : undefined;
      for (const [key, keyPattern, child] of children) {
        steps.push({
          pattern: keyPattern,
          child,
          value: mapValue ? mapValue.get(key) : objValue![key],
          path: invocationScope.stream.path.push(key).push(0),
        });
      }
      if (restChildren && pattern.rest) {
        if (mapValue) {
          const entries = [...mapValue.entries()];
          for (let i = 0; i < entries.length; i++) {
            const [key, value] = entries[i];
            if (typeof key === "string" && Object.hasOwn(keys, key)) {
              continue;
            }
            steps.push({
              pattern: pattern.rest.key,
              child: restChildren.key,
              value: key,
              path: invocationScope.stream.path.push(i).push("$key").push(0),
            });
            steps.push({
              pattern: pattern.rest.value,
              child: restChildren.value,
              value,
              path: invocationScope.stream.path.push(i).push(0),
            });
          }
        } else {
          for (
            const key of Object.keys(objValue!).filter((key) =>
              !Object.hasOwn(keys, key)
            )
          ) {
            steps.push({
              pattern: pattern.rest.key,
              child: restChildren.key,
              value: key,
              path: invocationScope.stream.path.push(key).push("$key").push(0),
            });
            steps.push({
              pattern: pattern.rest.value,
              child: restChildren.value,
              value: objValue![key],
              path: invocationScope.stream.path.push(key).push(0),
            });
          }
        }
      }
      return eachInOrder<Match, Match>(
        steps.length,
        (i) => {
          const propertyStream = new Input(
            [steps[i].value],
            steps[i].path,
            0,
            undefined,
            InputNormalizationMode.Iterable,
            false,
            false,
            false,
            next.value?.origin,
          );
          return steps[i].child(last.withInput(propertyStream));
        },
        (i, m) => {
          matches.push(m);
          switch (m.kind) {
            case MatchKind.LR:
            case MatchKind.Error:
              return m;
            case MatchKind.Fail:
              return fail(invocationScope, steps[i].pattern, matches);
            case MatchKind.Ok:
            case MatchKind.Skip:
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
