import { assertEquals, assertRejects } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  compileUffdaSyntaxModule,
  executeUffdaSource,
  UffdaCompilationError,
} from "./execute.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

Deno.test("lang.uffda.execute compiles through UffdaRuntimeCompiler", async () => {
  const module = await compileUffdaSyntaxModule({
    kind: "module",
    declarations: [
      { kind: "export", name: "Main" },
      { kind: "rule", name: "Main", pattern: { kind: PatternKind.Any } },
    ],
  });

  assertEquals(module.exports, [{
    kind: ExportDeclarationKind.Rule,
    name: "Main",
  }]);
  assertEquals(module.rules, [{
    name: "Main",
    parameters: [],
    pattern: { kind: PatternKind.Any },
    expression: undefined,
  }]);
});

Deno.test("lang.uffda.execute preserves compiler diagnostics when unwrapping failures", async () => {
  const error = await assertRejects(
    () =>
      compileUffdaSyntaxModule({
        kind: "module",
        declarations: [{ kind: "unsupported" }],
      } as unknown as UffdaSyntaxModule),
    UffdaCompilationError,
    'Uffda runtime compilation failed in CompileDeclaration at [0]."declarations".[0] with fail',
  );

  assertEquals(error.diagnostic, {
    matchKind: MatchKind.Fail,
    compilerRule: "CompileDeclaration",
    sourcePath: '[0]."declarations".[0]',
  });
});

Deno.test("lang.uffda.execute parses compiles and runs canonical any rule", async () => {
  const m = await executeUffdaSource("export Main; rule Main = any;", {
    entryRuleName: "Main",
    input: "z",
  });

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.value, "z");
  }
});

Deno.test("lang.uffda.execute parses compiles and runs canonical projection rule", async () => {
  const m = await executeUffdaSource("export One; rule One = any -> 1;", {
    entryRuleName: "One",
    input: "z",
  });

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind === MatchKind.Ok) {
    assertEquals(m.value, 1);
  }
});
