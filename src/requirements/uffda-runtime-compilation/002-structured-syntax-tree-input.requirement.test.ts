import { assertEquals, assertNotEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import {
  runUffdaRuntimeCompiler,
  UffdaRuntimeCompiler,
} from "../../lang/uffda/runtime.compiler.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";

Deno.test("req:uffda-runtime-compilation-002 - compiler consumes structured syntax tree input", async () => {
  assertEquals(UffdaRuntimeCompiler.imports, []);

  const structured = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [],
  });
  assertEquals(structured.kind, MatchKind.Ok);

  const sourceText = await executeModuleDeclaration(UffdaRuntimeCompiler, {
    input: '{"kind":"module","declarations":[]}',
  });
  assertNotEquals(sourceText.kind, MatchKind.Ok);
});
