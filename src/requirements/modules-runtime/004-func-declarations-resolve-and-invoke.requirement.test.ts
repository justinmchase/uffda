import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { MatchKind } from "../../match.ts";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
} from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import type { ModuleResolutionContext } from "../../runtime/resolvers/resolver.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";

const resolveContext = {
  scope: Scope.Default(),
  pattern: {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Run,
  },
} as ModuleResolutionContext;

const numberVar: Pattern = {
  kind: PatternKind.Variable,
  name: "a",
  pattern: { kind: PatternKind.Type, type: Type.Number },
};

Deno.test("req:modules-runtime-004 - local exported func invokes from projection", async () => {
  const m = await executeModuleDeclaration(
    {
      imports: [],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "Main" }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Invocation,
          expression: { kind: ExpressionKind.Reference, name: "Double" },
          args: [{ kind: ExpressionKind.Reference, name: "_" }],
        },
      }],
      funcs: [{
        name: "Double",
        pattern: numberVar,
        expression: {
          kind: ExpressionKind.Invocation,
          expression: { kind: ExpressionKind.Reference, name: "add" },
          args: [
            { kind: ExpressionKind.Reference, name: "a" },
            { kind: ExpressionKind.Reference, name: "a" },
          ],
        },
      }],
    },
    { input: 21, entryRuleName: "Main" },
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.value, 42);
  }
});

Deno.test("req:modules-runtime-004 - imported func shadows std global", async () => {
  const libUrl = new URL("file:///uffda/func-lib.ts");
  const appUrl = new URL("file:///uffda/func-app.ts");

  const m = await executeModuleDeclaration(
    {
      imports: [{
        kind: ImportDeclarationKind.Module,
        moduleUrl: libUrl.href,
        names: ["add"],
      }],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "Main" }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Invocation,
          expression: { kind: ExpressionKind.Reference, name: "add" },
          args: [
            { kind: ExpressionKind.Number, value: 2 },
            { kind: ExpressionKind.Number, value: 3 },
          ],
        },
      }],
      funcs: [],
    },
    {
      moduleUrl: appUrl,
      entryRuleName: "Main",
      input: null,
      declarations: {
        [libUrl.href]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Func, name: "add" }],
          rules: [],
          funcs: [{
            name: "add",
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                {
                  kind: PatternKind.Variable,
                  name: "a",
                  pattern: { kind: PatternKind.Type, type: Type.Number },
                },
                {
                  kind: PatternKind.Variable,
                  name: "b",
                  pattern: { kind: PatternKind.Type, type: Type.Number },
                },
              ],
            },
            expression: {
              kind: ExpressionKind.Number,
              value: 99,
            },
          }],
        },
      },
    },
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    // Shadowed `add` ignores args and returns 99, unlike std add.
    assertEquals(m.value, 99);
  }
});

Deno.test("req:modules-runtime-004 - import colliding with local func fails", async () => {
  const libUrl = new URL("file:///uffda/func-collide-lib.ts");
  const appUrl = new URL("file:///uffda/func-collide-app.ts");
  const resolver = new Resolver({
    declarations: {
      [libUrl.href]: {
        imports: [],
        exports: [{ kind: ExportDeclarationKind.Func, name: "Helper" }],
        rules: [],
        funcs: [{
          name: "Helper",
          pattern: { kind: PatternKind.End },
          expression: { kind: ExpressionKind.Number, value: 1 },
        }],
      },
      [appUrl.href]: {
        imports: [{
          kind: ImportDeclarationKind.Module,
          moduleUrl: libUrl.href,
          names: ["Helper"],
        }],
        exports: [],
        rules: [],
        funcs: [{
          name: "Helper",
          pattern: { kind: PatternKind.End },
          expression: { kind: ExpressionKind.Number, value: 2 },
        }],
      },
    },
  });

  const result = await resolver.import(appUrl, resolveContext);

  assertEquals(result.kind, ModuleImportResultKind.Error);
});

Deno.test("req:modules-runtime-004 - unknown func export fails", async () => {
  const moduleUrl = new URL("file:///uffda/missing-func.ts");
  const resolver = new Resolver({
    declarations: {
      [moduleUrl.href]: {
        imports: [],
        exports: [{ kind: ExportDeclarationKind.Func, name: "Missing" }],
        rules: [],
        funcs: [],
      },
    },
  });

  const result = await resolver.import(moduleUrl, resolveContext);

  assertEquals(result.kind, ModuleImportResultKind.Error);
});

Deno.test("req:modules-runtime-004 - arg pattern mismatch fails invocation", async () => {
  const m = await executeModuleDeclaration(
    {
      imports: [],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "Main" }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Invocation,
          expression: { kind: ExpressionKind.Reference, name: "OnlyNumber" },
          args: [{ kind: ExpressionKind.String, values: ["nope"] }],
        },
      }],
      funcs: [{
        name: "OnlyNumber",
        pattern: numberVar,
        expression: { kind: ExpressionKind.Reference, name: "a" },
      }],
    },
    { input: null, entryRuleName: "Main" },
  );

  assertEquals(m.kind === MatchKind.Ok, false);
});
