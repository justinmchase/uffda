import { assertEquals } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import { CliStreamFailureCode, compileStdinToArtifact } from "./stream.ts";

Deno.test("cli.stream parses one stdin source unit into a raw AST", async (t) => {
  await t.step("emits a module AST for valid full-Uffda input", async () => {
    const result = await compileStdinToArtifact(
      "export Main; rule Main = any;",
    );

    assertEquals(result.ok, true);
    if (!result.ok) return;
    assertEquals(result.ast.kind, "module");
  });

  await t.step("emits a parse diagnostic for invalid input", async () => {
    const result = await compileStdinToArtifact(
      "export Main; rule Main =",
    );

    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliStreamFailureCode.ParseFailure);
    assertEquals(result.error.phase, "parse");
    assertEquals(result.error.sourcePath, "<stdin>");
    assertEquals(result.error.language, CliLanguage.FullUffda);
  });

  await t.step(
    "treats empty input as an explicit empty module AST",
    async () => {
      const result = await compileStdinToArtifact("");

      assertEquals(result.ok, true);
      if (!result.ok) return;
      assertEquals(result.ast.kind, "module");
    },
  );

  await t.step("emits a pattern AST in pattern mode", async () => {
    const result = await compileStdinToArtifact(
      "X | Y",
      CliLanguage.Pattern,
    );

    assertEquals(result.ok, true);
    if (!result.ok) return;
    assertEquals(result.ast.kind, "or");
  });

  await t.step(
    "emits an expression AST in expression mode",
    async () => {
      const result = await compileStdinToArtifact(
        "[1 true]",
        CliLanguage.Expression,
      );

      assertEquals(result.ok, true);
      if (!result.ok) return;
      assertEquals(result.ast.kind, "array");
    },
  );
});
