import { assertEquals } from "@std/assert";
import { MatchKind, valueOf } from "../../match.ts";
import { runUffdaRuntimeCompiler } from "../../lang/uffda/runtime.compiler.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { unwrap } from "../../wrapped.ts";

Deno.test("req:uffda-runtime-compilation-004 - compilation and execution remain independent", async () => {
  const compiled = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [
      { kind: "export", name: "Main" },
      {
        kind: "rule",
        name: "Main",
        parameters: [],
        pattern: { kind: PatternKind.Any },
        attributes: [],
      },
    ],
  });

  assertEquals(compiled.kind, MatchKind.Ok);
  if (compiled.kind !== MatchKind.Ok) return;

  const executed = await executeModuleDeclaration(valueOf(compiled), {
    entryRuleName: "Main",
    input: "value",
  });

  assertEquals(executed.kind, MatchKind.Ok);
  if (executed.kind === MatchKind.Ok) {
    assertEquals(unwrap(executed.value), "value");
  }
});
