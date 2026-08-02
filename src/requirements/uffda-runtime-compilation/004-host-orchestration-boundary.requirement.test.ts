import { assertEquals } from "@std/assert";
import { MatchKind } from "../../match.ts";
import { runUffdaRuntimeCompiler } from "../../lang/uffda/runtime.compiler.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";

Deno.test("req:uffda-runtime-compilation-004 - compilation and execution remain independent", async () => {
  const compiled = await runUffdaRuntimeCompiler({
    kind: "module",
    declarations: [
      { kind: "export", name: "Main" },
      { kind: "rule", name: "Main", pattern: { kind: PatternKind.Any } },
    ],
  });

  assertEquals(compiled.kind, MatchKind.Ok);
  if (compiled.kind !== MatchKind.Ok) return;

  const executed = await executeModuleDeclaration(compiled.value, {
    entryRuleName: "Main",
    input: "value",
  });

  assertEquals(executed.kind, MatchKind.Ok);
  if (executed.kind === MatchKind.Ok) {
    assertEquals(executed.value, "value");
  }
});
