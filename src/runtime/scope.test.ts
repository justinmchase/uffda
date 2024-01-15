import {
  assertEquals,
  assertFalse,
  assertObjectMatch,
} from "std/assert/mod.ts";
import { match } from "./match.ts";
import { Pattern, PatternKind } from "./patterns/mod.ts";
import { Scope } from "./scope.ts";
import { Input } from "../input.ts";
import { Match } from "../match.ts";
import { Expression, ExpressionKind } from "./expressions/mod.ts";
import { exec } from "./exec.ts";

Deno.test("runtime.scope", async (t) => {
  await t.step({
    name: "SCOPE00",
    fn: async () => {
      const scope = Scope.From("abc");
      const pattern: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      };
      const result = await match(pattern, scope);
      const { matched, done } = result;
      const { start, end } = result.span();
      assertObjectMatch({ matched, done, start, end }, {
        matched: true,
        done: false,
        start: 0,
        end: 2,
      });
    },
  });

  await t.step({
    name: "SCOPE01",
    fn: async () => {
      const scope = Scope.From("ab");
      const pattern: Pattern = {
        kind: PatternKind.Equal,
        value: "a",
      };
      const result = await match(pattern, scope);
      const { matched, done } = result;
      const { start, end } = result.span();
      // It matched the full pattern but didn't consume all of the output
      assertEquals({ matched, done, start, end }, {
        matched: true,
        done: false,
        start: 0,
        end: 1,
      });
    },
  });

  await t.step({
    name: "SCOPE02",
    fn: async () => {
      const scope = Scope.From("abc");
      const pattern: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      };
      const result = await match(pattern, scope);
      const { matched, done } = result;
      const { start, end } = result.span();
      assertObjectMatch({ matched, done, start, end }, {
        matched: true,
        done: true,
        start: 0,
        end: 3,
      });
    },
  });

  await t.step({
    name: "SCOPE03",
    fn: () => {
      // patterns can't resolve global references
      const scope = Scope.Default()
        .withInput(Input.From(""))
        .withOptions({
          globals: new Map([
            ["x", 7],
          ]),
        });
      const pattern: Pattern = {
        kind: PatternKind.Reference,
        name: "x",
      };
      const { matched } = match(pattern, scope);
      assertFalse(matched);
    },
  });

  await t.step({
    name: "SCOPE04",
    fn: async () => {
      // expressions can resolve globals
      const scope = Scope.Default()
        .withInput(Input.From("a"))
        .withOptions({
          globals: new Map([
            ["x", 7],
          ]),
        });
      const match = Match.Default(scope);
      const expression: Expression = {
        kind: ExpressionKind.Reference,
        name: "x",
      };
      const result = await exec(expression, match);
      assertEquals(result, 7);
    },
  });

  await t.step({
    name: "SCOPE05",
    fn: async () => {
      // expressions can resolve globals
      const scope = Scope.From("a");
      const pattern: Pattern = {
        kind: PatternKind.Equal,
        value: "x",
      };
      const result = await match(pattern, scope);
      const { matched, done } = result;
      const { start, end } = result.span();
      assertEquals({ matched, done, start, end }, {
        matched: false,
        done: false,
        start: 0,
        end: 0,
      });
    },
  });
});
