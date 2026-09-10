import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { runUffdaRuntimeCompiler } from "../../lang/uffda/runtime.compiler.ts";
import { fromFileUrl, join } from "@std/path";

Deno.test("req:uffda-runtime-compilation-001 - compiler is an executable runtime language", async () => {
  const uff = await Deno.readTextFile(
    join(
      fromFileUrl(new URL("../../../", import.meta.url)),
      "src",
      "lang",
      "uffda",
      "runtime.compiler.uff",
    ),
  );
  assertEquals(uff.includes("export UffdaRuntimeCompiler"), true);
  assertEquals(uff.includes("rule UffdaRuntimeCompiler"), true);

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
      funcs: [],
    });
  }
});
