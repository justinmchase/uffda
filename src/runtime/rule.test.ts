import { assertEquals, assertStrictEquals } from "@std/assert";
import { Resolver } from "../mod.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import { moduleDeclarationTest } from "../test.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
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
              pattern: {
                kind: PatternKind.Equal,
                value: "a",
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
                  {
                    kind: PatternKind.Equal,
                    value: "a",
                  },
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
                      { kind: PatternKind.Equal, value: "a" },
                    ],
                  },
                  { kind: PatternKind.Equal, value: "a" },
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
                      { kind: PatternKind.Equal, value: "a" },
                      {
                        kind: PatternKind.Resolve,
                        targetKind: ResolveTargetKind.Reference,
                        name: "a",
                        args: [],
                      },
                    ],
                  },
                  { kind: PatternKind.Equal, value: "a" },
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
                fn: ({ x }: { x: "a" }) => (assertEquals(x, "a"), x),
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
    name: "RULE12",
    fn: async () => {
      const declarations: Record<string, ModuleDeclaration> = {
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
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Resolve,
                    targetKind: ResolveTargetKind.Reference,
                    name: "a",
                    args: [],
                  },
                  {
                    kind: PatternKind.Equal,
                    value: "a",
                  },
                ],
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
      const key = Symbol("broken-grow-memo");
      let storedMemo: { match: unknown } | undefined;
      const brokenMemos = {
        resolve: () => ({ key, memo: storedMemo }),
        set: (_path: unknown, _key: symbol, match: unknown) => {
          storedMemo = { match };
          return storedMemo;
        },
        get: () => ({ key, memo: undefined }),
      };
      const scope = new Scope(
        module.module,
        undefined,
        undefined,
        undefined,
        Input.Iterable("a"),
        brokenMemos as never,
        undefined,
        { resolver },
      );

      const m = await resolve(
        { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
        scope,
      );

      assertEquals(m.kind, MatchKind.Error);
      if (m.kind !== MatchKind.Error) return;
      assertEquals(m.code, MatchErrorCode.InternalInvariant);
      assertEquals(m.message, "left recursion memo missing during grow");
    },
  });
  // todo: two identical rules with different native projections should not trigger DLR?
});
