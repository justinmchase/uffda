import { assertEquals } from "@std/assert";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/syntax.types.ts";
import { lowerUffdaSyntaxModule } from "./lower_uffda_syntax.ts";

Deno.test("cli.lower_uffda_syntax lowers a syntax AST to ModuleDeclaration", async () => {
  const syntaxModule = {
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
  } as UffdaSyntaxModule;
  const declaration = await lowerUffdaSyntaxModule(syntaxModule);
  assertEquals(Array.isArray(declaration.imports), true);
  assertEquals(Array.isArray(declaration.exports), true);
  assertEquals(Array.isArray(declaration.rules), true);
  assertEquals(declaration.rules.some((r) => r.name === "Main"), true);
});
