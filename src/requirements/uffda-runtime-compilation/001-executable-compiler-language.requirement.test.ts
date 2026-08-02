import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import {
  runUffdaRuntimeCompiler,
  UffdaRuntimeCompiler,
} from "../../lang/uffda/runtime.compiler.ts";

Deno.test("req:uffda-runtime-compilation-001 - compiler is an executable runtime language", async () => {
  assertEquals(UffdaRuntimeCompiler.exports, [{
    kind: ExportDeclarationKind.Rule,
    name: "UffdaRuntimeCompiler",
    default: true,
  }]);

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
