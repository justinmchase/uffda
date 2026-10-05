import { assertEquals } from "@std/assert";
import { MatchKind } from "../match.ts";
import { executeModuleDeclaration } from "./module.execute.ts";
import { ExportDeclarationKind } from "./declarations/export.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ExpressionKind } from "./expressions/expression.kind.ts";
import { ValueSourceKind } from "./patterns/value_source.ts";
import type { ModuleDeclaration } from "./declarations/module.ts";
import { unwrap } from "../wrapped.ts";
import { ImportDeclarationKind } from "./declarations/import.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";

Deno.test("runtime.module.execute executes default exported rule", async () => {
  const m = await executeModuleDeclaration(
    {
      imports: [],
      exports: [{
        kind: ExportDeclarationKind.Rule,
        name: "Main",
        default: true,
      }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
      }],
    },
    { input: "x" },
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(unwrap(m.value), "x");
  }
});

Deno.test("runtime.module.execute matches in two phases", async () => {
  const declaration: ModuleDeclaration = {
    imports: [],
    exports: [{
      kind: ExportDeclarationKind.Rule,
      name: "Main",
      default: true,
    }],
    rules: [{
      name: "Main",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Recover,
            pattern: {
              kind: PatternKind.Equal,
              value: { kind: ValueSourceKind.Literal, value: "a" },
            },
            skip: { kind: PatternKind.Any },
          },
          { kind: PatternKind.End },
        ],
      },
    }],
  };

  const m = await executeModuleDeclaration(declaration, { input: "x" });
  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.recovered, true);
    assertEquals(unwrap(m.value), ["x", undefined]);
  }
});

Deno.test("runtime.module.execute executes named exported rule", async () => {
  const m = await executeModuleDeclaration(
    {
      imports: [],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "One" }],
      rules: [{
        name: "One",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: { kind: ExpressionKind.Number, value: 1 },
      }],
    },
    { input: "x", entryRuleName: "One" },
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(unwrap(m.value), 1);
  }
});

Deno.test("runtime.module.execute resolves module names through its import map", async () => {
  const tokens = "jsr:@acme/kv@^1.2.0/tokens";
  const m = await executeModuleDeclaration(
    {
      imports: [{
        kind: ImportDeclarationKind.Module,
        moduleUrl: "@acme/kv/tokens",
        names: ["T"],
      }],
      exports: [{
        kind: ExportDeclarationKind.Rule,
        name: "Main",
        default: true,
      }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "T",
          args: [],
        },
      }],
    },
    {
      input: "x",
      moduleUrl: new URL("file:///uffda-execute/main.uff"),
      imports: new Map([["@acme/kv", "jsr:@acme/kv@^1.2.0"]]),
      declarations: {
        [tokens]: {
          imports: [],
          exports: [{ kind: ExportDeclarationKind.Rule, name: "T" }],
          rules: [{
            name: "T",
            parameters: [],
            pattern: { kind: PatternKind.Any },
          }],
        },
      },
    },
  );
  assertEquals(m.kind, MatchKind.Ok);
});

Deno.test("runtime.module.execute reads .uff imports from its artifact layout", async () => {
  const root = await Deno.makeTempDir({ prefix: "uffda-execute-layout-" });
  try {
    const outDir = `${root}/out`;
    await Deno.mkdir(`${outDir}/ast`, { recursive: true });
    await Deno.writeTextFile(
      `${outDir}/ast/dep.uffda.ast.json`,
      JSON.stringify({
        imports: [],
        exports: [{ kind: ExportDeclarationKind.Rule, name: "T" }],
        rules: [{ name: "T", parameters: [], pattern: { kind: "any" } }],
      }),
    );
    const m = await executeModuleDeclaration(
      {
        imports: [{
          kind: ImportDeclarationKind.Module,
          moduleUrl: "./dep.uff",
          names: ["T"],
        }],
        exports: [{
          kind: ExportDeclarationKind.Rule,
          name: "Main",
          default: true,
        }],
        rules: [{
          name: "Main",
          parameters: [],
          pattern: {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "T",
            args: [],
          },
        }],
      },
      {
        input: "x",
        moduleUrl: new URL(`file://${root}/main.uff`),
        artifacts: { root, outDir },
      },
    );
    assertEquals(m.kind, MatchKind.Ok);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
