import { Type, type } from "@justinmchase/type";
import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { compile } from "../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { OverPattern } from "./pattern.ts";
import { andThen, type AwaitableMatch, eachInOrder } from "../awaitable.ts";
import type { Awaitable } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import { rawOf } from "../../wrapped.ts";

type Entry = {
  key: unknown;
  value: unknown;
  keyPath: Input["path"];
  valuePath: Input["path"];
};

type RestChild = {
  key: CompiledPattern;
  value: CompiledPattern;
};

type EntryResult =
  | { kind: "matched"; scope: Scope; matches: Match[] }
  | { kind: "miss"; matches: Match[] }
  | { kind: "stop"; match: Match; matches: Match[] };

/** Compiles an `Over` pattern into a flattened, reusable closure. */
export function over(pattern: OverPattern, scope: Scope): CompiledPattern {
  const { keys = {}, rest = [] } = pattern;
  const children = Object.entries(keys).map(
    ([key, keyPattern]) =>
      [key, keyPattern, compile(keyPattern, scope)] as const,
  );
  const restChildren: (RestChild | undefined)[] = rest.map((clause) =>
    clause.kind === "pattern"
      ? {
        key: compile(clause.key, scope),
        value: compile(clause.value, scope),
      }
      : undefined
  );

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

      const mapValue = t === Type.Map
        ? raw as Map<unknown, unknown>
        : undefined;
      const objValue = t === Type.Object
        ? raw as Record<PropertyKey, unknown>
        : undefined;
      const entries: Entry[] = mapValue
        ? [...mapValue.entries()].map(([key, value], i) => ({
          key,
          value,
          keyPath: invocationScope.stream.path.push(i).push("$key").push(0),
          valuePath: invocationScope.stream.path.push(i).push(0),
        }))
        : Object.keys(objValue!).map((key) => ({
          key,
          value: objValue![key],
          keyPath: invocationScope.stream.path.push(key).push("$key").push(0),
          valuePath: invocationScope.stream.path.push(key).push(0),
        }));

      const remaining = entries.filter((entry) =>
        typeof entry.key !== "string" || !Object.hasOwn(keys, entry.key)
      );
      let last = invocationScope;
      const matches: Match[] = [];
      const fixedSteps = children.map(([key, keyPattern, child]) => ({
        pattern: keyPattern,
        child,
        value: mapValue
          ? mapValue.has(key) ? mapValue.get(key) : undefined
          : objValue![key],
        path: invocationScope.stream.path.push(key).push(0),
      }));

      const finish = (): Match =>
        ok(
          invocationScope,
          invocationScope.withInput(next).addVariables(last.variables),
          pattern,
          next.value,
          matches,
        );

      const runChild = (
        child: CompiledPattern,
        value: unknown,
        path: Input["path"],
        childScope: Scope,
      ): AwaitableMatch => {
        const input = new Input(
          [value],
          path,
          0,
          undefined,
          InputNormalizationMode.Iterable,
          false,
          false,
          false,
          next.value?.origin,
        );
        return child(childScope.withInput(input));
      };

      const matchEntry = (
        entry: Entry,
        clauseIndex: number,
        entryScope: Scope,
        attempts: Match[] = [],
      ): Awaitable<EntryResult> => {
        if (clauseIndex === rest.length) {
          return { kind: "miss", matches: attempts };
        }
        const clause = rest[clauseIndex];
        if (clause.kind === "any") {
          return { kind: "matched", scope: entryScope, matches: attempts };
        }
        const child = restChildren[clauseIndex]!;
        return andThen(
          runChild(child.key, entry.key, entry.keyPath, entryScope),
          (keyMatch): Awaitable<EntryResult> => {
            switch (keyMatch.kind) {
              case MatchKind.LR:
              case MatchKind.Error:
                return {
                  kind: "stop",
                  match: keyMatch,
                  matches: [...attempts, keyMatch],
                };
              case MatchKind.Fail:
                return matchEntry(
                  entry,
                  clauseIndex + 1,
                  entryScope,
                  [...attempts, keyMatch],
                );
              case MatchKind.Ok:
              case MatchKind.Skip:
                return andThen(
                  runChild(
                    child.value,
                    entry.value,
                    entry.valuePath,
                    keyMatch.scope,
                  ),
                  (valueMatch): Awaitable<EntryResult> => {
                    const childMatches = [...attempts, keyMatch, valueMatch];
                    switch (valueMatch.kind) {
                      case MatchKind.LR:
                      case MatchKind.Error:
                        return {
                          kind: "stop",
                          match: valueMatch,
                          matches: childMatches,
                        };
                      case MatchKind.Fail:
                        return matchEntry(
                          entry,
                          clauseIndex + 1,
                          entryScope,
                          childMatches,
                        );
                      case MatchKind.Ok:
                      case MatchKind.Skip:
                        return {
                          kind: "matched",
                          scope: valueMatch.scope,
                          matches: childMatches,
                        };
                    }
                  },
                );
            }
          },
        );
      };

      const matchRemainingEntries = (): AwaitableMatch => {
        if (rest.length === 0) {
          return finish();
        }
        return eachInOrder<EntryResult, Match>(
          remaining.length,
          (i) => matchEntry(remaining[i], 0, last),
          (_, result) => {
            matches.push(...result.matches);
            switch (result.kind) {
              case "stop":
                return result.match;
              case "miss":
                return fail(invocationScope, pattern, matches);
              case "matched":
                last = result.scope;
                return undefined;
            }
          },
          finish,
        );
      };

      return andThen(
        eachInOrder<Match, Match | undefined>(
          fixedSteps.length,
          (i) =>
            runChild(
              fixedSteps[i].child,
              fixedSteps[i].value,
              fixedSteps[i].path,
              last,
            ),
          (i, match) => {
            matches.push(match);
            switch (match.kind) {
              case MatchKind.LR:
              case MatchKind.Error:
                return match;
              case MatchKind.Fail:
                return fail(invocationScope, fixedSteps[i].pattern, matches);
              case MatchKind.Ok:
              case MatchKind.Skip:
                last = match.scope;
                return undefined;
            }
          },
          () => undefined,
        ),
        (fixedMatch) => fixedMatch ?? matchRemainingEntries(),
      );
    });
}
