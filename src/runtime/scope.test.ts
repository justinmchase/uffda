import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import { match } from "./match.ts";
import { PatternKind } from "./patterns/mod.ts";
import { Scope } from "./scope.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { MatchKind, ok } from "../match.ts";
import { exec } from "./exec.ts";
import { Path } from "../path.ts";
import { ExpressionKind } from "./expressions/mod.ts";
import type { Pattern } from "./patterns/mod.ts";
import type { Expression } from "./expressions/mod.ts";

Deno.test("runtime.scope", async (t) => {
  await t.step({
    name: "SCOPE00",
    fn: async () => {
      const scope = Scope.From("abc", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      const done = m.scope.stream.done;
      const { start, end } = m.span;
      assertObjectMatch({ done, start, end }, {
        done: false,
        start: Path.From(0),
        end: Path.From(2),
      });
    },
  });

  await t.step({
    name: "SCOPE01",
    fn: async () => {
      const scope = Scope.From("ab", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = {
        kind: PatternKind.Equal,
        value: "a",
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      const done = m.scope.stream.done;
      const { start, end } = m.span;
      // It matched the full pattern but didn't consume all of the output
      assertEquals({ done, start, end }, {
        done: false,
        start: Path.From(0),
        end: Path.From(1),
      });
    },
  });

  await t.step({
    name: "SCOPE02",
    fn: async () => {
      const scope = Scope.From("abc", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      const { done } = m.scope.stream;
      const { start, end } = m.span;
      assertObjectMatch({ done, start, end }, {
        done: true,
        start: Path.From(0),
        end: Path.From(3),
      });
    },
  });

  await t.step({
    name: "SCOPE03",
    fn: async () => {
      // patterns can't resolve global references
      const scope = Scope
        .Default()
        .withInput(Input.Iterable(""))
        .withOptions({
          globals: new Map([
            ["x", 7],
          ]),
        });
      const pattern: Pattern = {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "x",
        args: [],
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Error, `Expected fail but got ${m.kind}`);
    },
  });

  await t.step({
    name: "SCOPE04",
    fn: async () => {
      // expressions can resolve globals
      const scope = Scope.Default()
        .withInput(Input.Iterable("a"))
        .withOptions({
          globals: new Map([
            ["x", 7],
          ]),
        });
      const match = ok(scope, scope, { kind: PatternKind.Ok }, undefined);
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
      const scope = Scope.From("a", {
        kind: InputNormalizationMode.Iterable,
      });
      const pattern: Pattern = {
        kind: PatternKind.Equal,
        value: "x",
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Fail);
      const done = m.scope.stream.done;
      const { start, end } = m.span;
      assertEquals({ done, start, end }, {
        done: false,
        start: Path.From(0),
        end: Path.From(0),
      });
    },
  });

  await t.step({
    name: "SCOPE06",
    fn: async () => {
      const scope = Scope.From("abc");
      const pattern: Pattern = {
        kind: PatternKind.Equal,
        value: "abc",
      };
      const m = await match(pattern, scope);
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.scope.stream.done, true);
      assertEquals(m.span.start, Path.From(0));
      assertEquals(m.span.end, Path.From(1));
    },
  });
});
