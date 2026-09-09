import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";
import {
  diagnoseUffdaRuntimeCompilerFailure,
  runUffdaRuntimeCompiler,
} from "./runtime.compiler.ts";

Deno.test("lang.uffda.runtime-compiler compiles an empty syntax module", async () => {
  const match = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [],
  });

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(match.value, {
      imports: [],
      exports: [],
      rules: [],
    });
  }
});

Deno.test("lang.uffda.runtime-compiler compiles declaration families", async () => {
  const syntaxModule: UffdaSyntaxModule = {
    kind: "module",
    declarations: [
      {
        kind: "import",
        moduleUrl: "./symbols.ts",
        names: ["Letter", "Space"],
      },
      {
        kind: "export",
        name: "Main",
      },
      {
        kind: "rule",
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        projection: { kind: ExpressionKind.Value, value: "compiled" },
      },
      {
        kind: "rule",
        name: "Stop",
        parameters: [],
        pattern: { kind: PatternKind.Equal, value: "." },
      },
    ],
  };

  const match = await runUffdaRuntimeCompiler(syntaxModule);

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(match.value, {
      imports: [{
        kind: ImportDeclarationKind.Module,
        moduleUrl: "./symbols.ts",
        names: ["Letter", "Space"],
      }],
      exports: [{
        kind: ExportDeclarationKind.Rule,
        name: "Main",
      }],
      rules: [{
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: { kind: ExpressionKind.Value, value: "compiled" },
      }, {
        name: "Stop",
        parameters: [],
        pattern: { kind: PatternKind.Equal, value: "." },
        expression: undefined,
      }],
    });
  }
});

Deno.test(
  "lang.uffda.runtime-compiler re-exports imports as ExportDeclarationKind.Import",
  async () => {
    const syntaxModule: UffdaSyntaxModule = {
      kind: "module",
      declarations: [
        {
          kind: "import",
          moduleUrl: "./digit.uff",
          names: ["Digit"],
        },
        {
          kind: "export",
          name: "Digit",
        },
      ],
    };

    const match = await runUffdaRuntimeCompiler(syntaxModule);
    assertEquals(match.kind, MatchKind.Ok);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value, {
        imports: [{
          kind: ImportDeclarationKind.Module,
          moduleUrl: "./digit.uff",
          names: ["Digit"],
        }],
        exports: [{
          kind: ExportDeclarationKind.Import,
          name: "Digit",
        }],
        rules: [],
      });
    }
  },
);

Deno.test("lang.uffda.runtime-compiler rejects unsupported declarations", async () => {
  const match = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [{ kind: "unsupported" } as never],
  });

  assertEquals(match.kind, MatchKind.Fail);
  assertEquals(diagnoseUffdaRuntimeCompilerFailure(match), {
    matchKind: MatchKind.Fail,
    compilerRule: "CompileDeclaration",
    sourcePath: '[0]."declarations".[0]',
  });
});

Deno.test("lang.uffda.runtime-compiler rejects malformed module input", async (t) => {
  await t.step("rejects a different AST kind", async () => {
    const match = await runUffdaRuntimeCompiler({
      kind: "rule",
      declarations: [],
    } as never);
    assertEquals(match.kind, MatchKind.Fail);
  });

  await t.step("rejects a non-object module shape", async () => {
    const match = await runUffdaRuntimeCompiler("not-a-module" as never);
    assertEquals(
      match.kind === MatchKind.Fail || match.kind === MatchKind.Error,
      true,
    );
  });
});
