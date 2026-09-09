import { assertEquals, assertRejects } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  compileUffdaSource,
  compileUffdaSyntaxModule,
  executeUffdaSource,
  UffdaCompilationError,
} from "./execute.ts";
import { uffdaGrammar } from "./uffda.lang.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

Deno.test("lang.uffda.execute compiles through UffdaRuntimeCompiler", async () => {
  const module = await compileUffdaSyntaxModule({
    kind: "module",
    declarations: [
      { kind: "export", name: "Main" },
      {
        kind: "rule",
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
      },
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

Deno.test("lang.uffda.execute parses compiles and runs parametric surround rule", async () => {
  const source =
    `export rule Surround<L, P, R> = L? p:P R? -> p; export Main; rule Open = "("; rule Close = ")"; rule X = "x"; rule Main = Surround<Open, X, Close>;`;
  for (const input of ["(x)", "(x", "x)", "x"]) {
    const m = await executeUffdaSource(source, {
      entryRuleName: "Main",
      input: Input.Iterable(input),
    });
    assertEquals(m.kind, MatchKind.Ok, `input ${JSON.stringify(input)}`);
    if (m.kind === MatchKind.Ok) {
      assertEquals(m.value, "x");
    }
  }

  const fail = await executeUffdaSource(source, {
    entryRuleName: "Main",
    input: Input.Iterable("()"),
  });
  assertEquals(fail.kind, MatchKind.Fail);
});

Deno.test("lang.uffda.execute compileUffdaSource matches uffdaGrammar + compileUffdaSyntaxModule", async () => {
  const source = "export Main; rule Main = any;";

  const single = await compileUffdaSource(source);
  assertEquals(single.kind, MatchKind.Ok);

  const parsed = await uffdaGrammar(source);
  assertEquals(parsed.kind, MatchKind.Ok);
  if (parsed.kind !== MatchKind.Ok) return;
  const twoStep = await compileUffdaSyntaxModule(parsed.value);

  if (single.kind === MatchKind.Ok) {
    assertEquals(single.value, twoStep);
  }
});

Deno.test("lang.uffda.execute compileUffdaSource surfaces parse failures", async () => {
  const failed = await compileUffdaSource("rule Main = ;");
  assertEquals(failed.kind === MatchKind.Ok, false);
});
