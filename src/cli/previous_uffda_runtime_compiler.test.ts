import { assertEquals } from "@std/assert";
import { UffdaRuntimeCompiler } from "./previous_uffda_runtime_compiler.ts";

Deno.test("cli.previous_uffda_runtime_compiler exports frozen ModuleDeclaration", () => {
  assertEquals(Array.isArray(UffdaRuntimeCompiler.imports), true);
  assertEquals(Array.isArray(UffdaRuntimeCompiler.exports), true);
  assertEquals(Array.isArray(UffdaRuntimeCompiler.rules), true);
  assertEquals(
    UffdaRuntimeCompiler.exports.some((e) => e.name === "UffdaRuntimeCompiler"),
    true,
  );
});
