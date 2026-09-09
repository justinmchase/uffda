import { assertEquals, assertNotEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { runUffdaRuntimeCompiler } from "../../lang/uffda/runtime.compiler.ts";
import { fromFileUrl, join } from "@std/path";

Deno.test("req:uffda-runtime-compilation-002 - compiler consumes structured syntax tree input", async () => {
  const uff = await Deno.readTextFile(
    join(
      fromFileUrl(new URL("../../../", import.meta.url)),
      "src",
      "lang",
      "uffda",
      "runtime.compiler.uff",
    ),
  );
  assertEquals(uff.includes('kind: "module"'), true);
  assertEquals(uff.includes("[CompileDeclarations]"), true);

  const structured = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [],
  });
  assertEquals(structured.kind, MatchKind.Ok);

  const sourceText = await runUffdaRuntimeCompiler(
    '{"kind":"module","declarations":[]}' as never,
  );
  assertNotEquals(sourceText.kind, MatchKind.Ok);
});
