import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { runUffdaRuntimeCompiler } from "../../lang/uffda/runtime.compiler.ts";

Deno.test("req:uffda-runtime-compilation-003 - compiler rules transform declaration sequences", async () => {
  const match = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [
      { kind: "import", moduleUrl: "./a.ts", names: ["A"] },
      { kind: "import", moduleUrl: "./b.ts", names: ["B"] },
      { kind: "export", name: "First" },
      {
        kind: "rule",
        name: "First",
        parameters: [],
        pattern: { kind: PatternKind.Any },
      },
      {
        kind: "rule",
        name: "Second",
        parameters: [],
        pattern: { kind: PatternKind.End },
      },
    ],
  });

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(match.value, {
      imports: [
        {
          kind: ImportDeclarationKind.Module,
          moduleUrl: "./a.ts",
          names: ["A"],
        },
        {
          kind: ImportDeclarationKind.Module,
          moduleUrl: "./b.ts",
          names: ["B"],
        },
      ],
      exports: [{ kind: ExportDeclarationKind.Rule, name: "First" }],
      rules: [{
        name: "First",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        expression: undefined,
      }, {
        name: "Second",
        parameters: [],
        pattern: { kind: PatternKind.End },
        expression: undefined,
      }],
      funcs: [],
    });
  }
});
