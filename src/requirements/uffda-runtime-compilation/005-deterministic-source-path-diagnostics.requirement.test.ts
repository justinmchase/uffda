import { assertEquals } from "@std/assert";
import {
  diagnoseUffdaRuntimeCompilerFailure,
  runUffdaRuntimeCompiler,
} from "../../lang/uffda/runtime.compiler.ts";
import type { UffdaSyntaxModule } from "../../lang/uffda/syntax.types.ts";

Deno.test("req:uffda-runtime-compilation-005 - compiler diagnostics identify a rule and source AST path deterministically", async () => {
  const syntaxModule = {
    kind: "module" as const,
    declarations: [{ kind: "unsupported" }],
  } as unknown as UffdaSyntaxModule;

  const first = diagnoseUffdaRuntimeCompilerFailure(
    await runUffdaRuntimeCompiler(syntaxModule),
  );
  const second = diagnoseUffdaRuntimeCompilerFailure(
    await runUffdaRuntimeCompiler(syntaxModule),
  );

  assertEquals(first, {
    matchKind: "fail",
    compilerRule: "CompileDeclaration",
    sourcePath: '[0]."declarations".[0]',
  });
  assertEquals(second, first);
});
