import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { rule } from "./rule.ts";
import { DefaultModule } from "./modules/module.ts";
import { InputNormalizationMode } from "../input.ts";
import { Resolver } from "../mod.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import { moduleDeclarationTest } from "../test.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { lit } from "./patterns/value_source.ts";
import { Input } from "../input.ts";
import { MatchErrorCode, MatchKind, Path } from "../mod.ts";
import { ModuleImportResultKind } from "./resolvers/resolver.ts";
import { Scope } from "./scope.ts";
import { resolve } from "./patterns/resolve.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
} from "./declarations/mod.ts";
import type { ModuleDeclaration } from "./declarations/module.ts";
import { unwrap, type Wrapped } from "../wrapped.ts";
import type { Match, MatchOrigin } from "../match.ts";

Deno.test("runtime.rule", async (t) => {
  await t.step({
    name: "RULE00",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "R",
            default: true,
          }],
          rules: [
            {
              name: "R",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: lit("a") },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "RULE01",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "a",
            default: true,
          }],
          rules: [
            {
              // a = a | 'a'
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "a",
                    args: [],
                  },
                  { kind: PatternKind.Equal, value: lit("a") },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("aa"),
      value: "a",
      done: false,
    }),
  });

  await t.step({
    name: "RULE02",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "a",
            default: true,
          }],
          rules: [
            {
              name: "a",
              parameters: [],
              // a = a 'a' | 'a'
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "a",
                        args: [],
                      },
                      { kind: PatternKind.Equal, value: lit("a") },
                    ],
                  },
                  { kind: PatternKind.Equal, value: lit("a") },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("aaa"),
      value: [["a", "a"], "a"],
    }),
  });

  await t.step({
    name: "RULE03",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "a" },
            { kind: ExportDeclarationKind.Rule, name: "b", default: true },
          ],
          rules: [
            {
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "b",
                args: [],
              },
            },
            {
              name: "b",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "a",
                args: [],
              },
            },
          ],
        },
      },
      kind: MatchKind.Fail,
      input: Input.Iterable("ab"),
    }),
  });

  await t.step({
    name: "RULE04",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "a",
            default: true,
          }],
          rules: [
            {
              // a = 'a' a | 'a'
              name: "a",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      { kind: PatternKind.Equal, value: lit("a") },
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "a",
                        args: [],
                      },
                    ],
                  },
                  { kind: PatternKind.Equal, value: lit("a") },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("aaa"),
      value: ["a", ["a", "a"]],
    }),
  });

  await t.step({
    name: "RULE05",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "P0" },
            { kind: ExportDeclarationKind.Rule, name: "P1", default: true },
          ],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: (
                  { x }: { x: undefined },
                ) => (assertStrictEquals(x, undefined), true),
              },
            },
            {
              name: "P1",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Variable,
                    name: "x",
                    pattern: { kind: PatternKind.Any },
                  },
                  {
                    kind: PatternKind.Or,
                    patterns: [
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "P0",
                        args: [],
                      },
                      { kind: PatternKind.Any },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("ab"),
      value: ["a", true],
    }),
  });

  await t.step({
    name: "RULE06",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "P0" },
            { kind: ExportDeclarationKind.Rule, name: "P1", default: true },
          ],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: {
                kind: PatternKind.Variable,
                name: "x",
                pattern: { kind: PatternKind.Any },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ x }: { x: Wrapped }) => (assertEquals(x.raw, "a"), x),
              },
            },
            {
              name: "P1",
              parameters: [],
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "P0",
                args: [],
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ x, _ }: { x: undefined; _: unknown }) => (
                  assertStrictEquals(x, undefined), _
                ),
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "RULE07",
    fn: moduleDeclarationTest({
      moduleUrl: "file:///m1.ts",
      declarations: {
        ["file:///m0.ts"]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P0",
            default: true,
          }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ x }: { x: undefined }) => (
                  assertStrictEquals(x, undefined), true
                ),
              },
            },
          ],
        },
        ["file:///m1.ts"]: {
          imports: [
            {
              kind: ImportDeclarationKind.Module,
              moduleUrl: "file:///m0.ts",
              names: ["P0"],
            },
          ],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P1",
            default: true,
          }],
          rules: [
            {
              name: "P1",
              parameters: [],
              pattern: {
                kind: PatternKind.Then,
                patterns: [
                  {
                    kind: PatternKind.Variable,
                    name: "x",
                    pattern: { kind: PatternKind.Any },
                  },
                  {
                    kind: PatternKind.Or,
                    patterns: [
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "P0",
                        args: [],
                      },
                      { kind: PatternKind.Any },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("ab"),
      value: ["a", true],
    }),
  });

  await t.step({
    name: "RULE08",
    fn: moduleDeclarationTest({
      moduleUrl: "file:///m0.ts",
      declarations: {
        ["file:///m0.ts"]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P0",
            default: true,
          }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => "b",
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("a"),
      value: "b",
    }),
  });

  await t.step({
    name: "RULE09",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url,
      declarations: {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P0",
            default: true,
          }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Reference,
                name: "missing",
              },
            },
          ],
        },
      },
      kind: MatchKind.Error,
      code: MatchErrorCode.ExpressionException,
      message: "expression exception: unknown reference: missing",
      start: Path.From(0),
      end: Path.From(0),
      input: Input.Iterable("a"),
    }),
  });

  await t.step({
    name: "RULE10",
    fn: async () => {
      const declarations: Record<string, ModuleDeclaration> = {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P0",
            default: true,
          }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Reference,
                name: "missing",
              },
            },
          ],
        },
      };

      const resolver = new Resolver({ declarations });
      const importScope = new Scope(
        undefined,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );
      const module = await resolver.import(new URL(import.meta.url), {
        scope: importScope,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
      });
      assertEquals(module.kind, ModuleImportResultKind.Module);
      if (module.kind !== ModuleImportResultKind.Module) return;
      const scope = new Scope(
        module.module,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );

      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.ExpressionException);
      assertEquals(
        m.message,
        "expression exception: unknown reference: missing",
      );
      assertEquals(m.error instanceof ReferenceError, true);
      assertEquals(m.error?.message, "unknown reference: missing");
    },
  });

  await t.step({
    name: "RULE11",
    fn: async () => {
      const declarations: Record<string, ModuleDeclaration> = {
        [import.meta.url]: {
          imports: [],
          exports: [{
            kind: ExportDeclarationKind.Rule,
            name: "P0",
            default: true,
          }],
          rules: [
            {
              name: "P0",
              parameters: [],
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: () => {
                  throw "boom";
                },
              },
            },
          ],
        },
      };

      const resolver = new Resolver({ declarations });
      const importScope = new Scope(
        undefined,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );
      const module = await resolver.import(new URL(import.meta.url), {
        scope: importScope,
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
      });
      assertEquals(module.kind, ModuleImportResultKind.Module);
      if (module.kind !== ModuleImportResultKind.Module) return;
      const scope = new Scope(
        module.module,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        undefined,
        undefined,
        { resolver },
      );

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );

      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.ExpressionException);
      assertEquals(m.message, "expression exception: boom");
      assertStrictEquals(m.error, undefined);
      assertEquals(m.cause, "boom");
    },
  });

  await t.step({
    name: "RULE13",
    fn: moduleDeclarationTest({
      moduleUrl: import.meta.url + "#memo-post-expression",
      declarations: {
        [import.meta.url + "#memo-post-expression"]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "R" },
            {
              kind: ExportDeclarationKind.Rule,
              name: "Main",
              default: true,
            },
          ],
          rules: [
            {
              // R projects away the raw token so rematches must not revive it.
              name: "R",
              parameters: [],
              pattern: { kind: PatternKind.Equal, value: lit("a") },
              expression: {
                kind: ExpressionKind.Native,
                fn: () => "projected",
              },
            },
            {
              // (R "x") | R — first arm matches R then fails on "x"; second arm
              // rematches R at the same position and must see the projection.
              name: "Main",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "R",
                        args: [],
                      },
                      { kind: PatternKind.Equal, value: lit("x") },
                    ],
                  },
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "R",
                    args: [],
                  },
                ],
              },
            },
          ],
        },
      },
      kind: MatchKind.Ok,
      input: Input.Iterable("a"),
      value: "projected",
    }),
  });
  await t.step({
    name: "RULE14",
    // E = T; T = E "+" "n" | "n": left recursion re-entering E passes
    // through T, so E grows and T's outcomes are marked as seeded by that
    // growth while E's own outcome is not.
    fn: async () => {
      const ref = (name: string) => ({
        kind: PatternKind.Resolve as const,
        targetKind: ResolveTargetKind.Reference as const,
        name,
        args: [],
      });
      const n = { kind: PatternKind.Equal as const, value: lit("n") };
      const declarations: Record<string, ModuleDeclaration> = {
        [import.meta.url]: {
          imports: [],
          exports: [
            { kind: ExportDeclarationKind.Rule, name: "E", default: true },
          ],
          rules: [
            { name: "E", parameters: [], pattern: ref("T") },
            {
              name: "T",
              parameters: [],
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Then,
                    patterns: [
                      ref("E"),
                      { kind: PatternKind.Equal, value: lit("+") },
                      n,
                    ],
                  },
                  n,
                ],
              },
            },
          ],
        },
      };
      const resolver = new Resolver({ declarations });
      const module = await resolver.import(new URL(import.meta.url), {
        scope: Scope.From("", { kind: InputNormalizationMode.Iterable }),
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
      });
      assertEquals(module.kind, ModuleImportResultKind.Module);
      if (module.kind !== ModuleImportResultKind.Module) return;
      const scope = new Scope(
        module.module,
        undefined,
        undefined,
        undefined,
        Input.Iterable("n+n"),
        undefined,
        undefined,
        { resolver },
      );

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );

      assertEquals(m.kind, MatchKind.Ok);
      if (m.kind !== MatchKind.Ok) return;
      assertEquals(unwrap(m.value), ["n", "+", "n"]);
      assertEquals(m.origin?.rule.name, "E");
      assertEquals(m.origin?.seeded, undefined);
      const origins: MatchOrigin[] = [];
      const visit = (node: Match) => {
        if (node.kind !== MatchKind.Ok && node.kind !== MatchKind.Fail) return;
        if (node.origin?.rule.name === "T") origins.push(node.origin);
        node.matches.forEach(visit);
      };
      visit(m);
      assert(origins.length > 0);
      assert(origins.every((origin) => origin.seeded === true));
    },
  });

  // todo: two identical rules with different native projections should not trigger DLR?

  await t.step(
    "RULE_BOUNDARY - a fresh rule invocation returns a promise",
    async () => {
      const result = rule(
        {
          name: "Any",
          module: DefaultModule(),
          parameters: [],
          pattern: { kind: PatternKind.Any },
        },
        new Map(),
        Scope.From("a", { kind: InputNormalizationMode.Iterable }),
      );
      assert(result instanceof Promise);
      assertEquals((await result).kind, MatchKind.Ok);
    },
  );
});
