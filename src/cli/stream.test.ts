import { assertEquals, assertStringIncludes } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import {
  CliStreamFailureCode,
  compileStdinToArtifact,
  parseFailureLocation,
  parseSourceToAst,
  recoveryFailures,
} from "./stream.ts";
import { executeUffdaSource } from "../lang/uffda/execute.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { Path } from "../path.ts";
import type { Edit } from "../edit.ts";
import { rehydrateMemos } from "../runtime/incremental.ts";
import { MatchKind } from "../match.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/uffda.lang.ts";

Deno.test("cli.stream parses one stdin source unit into a raw AST", async (t) => {
  await t.step("emits a module AST for valid full-Uffda input", async () => {
    const result = await compileStdinToArtifact(
      "export Main; rule Main = any;",
    );

    assertEquals(result.ok, true);
    if (!result.ok) return;
    assertEquals(result.ast.kind, "module");
  });

  await t.step(
    "parseFailureLocation agrees with a failed parse's reported location",
    async () => {
      const source = "\n) any";
      const parsed = await parseSourceToAst(source, CliLanguage.Pattern, "t");
      assertEquals(parsed.ok, false);
      if (parsed.ok) return;
      assertEquals(
        await parseFailureLocation(parsed.match, source),
        parsed.error.location,
      );
      assertEquals(parsed.error.location?.line, 1);
    },
  );

  await t.step("emits a parse diagnostic for invalid input", async () => {
    const result = await compileStdinToArtifact(
      "export Main; rule Main =",
    );

    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliStreamFailureCode.Recovered);
    assertEquals(result.error.phase, "parse");
    assertEquals(result.error.sourcePath, "<stdin>");
    assertEquals(result.error.language, CliLanguage.FullUffda);
    assertEquals(result.error.location?.line, 0);
    // Covers the skipped declaration, whose pattern body is missing.
    assertEquals(
      result.error.location?.offset,
      "export Main; ".length,
    );
    assertEquals(
      result.error.location?.endOffset,
      "export Main; rule Main =".length,
    );
    assertStringIncludes(result.error.message, "Expected");
    assertStringIncludes(
      result.error.message,
      "RulePatternBodyBeforeProjection",
    );
  });

  await t.step(
    "points a naked pipeline operator at the following token, not EOF",
    async () => {
      const source = [
        "export Main;",
        "rule Main =",
        "  (",
        "    any",
        "    |> ",
        "  )",
        "  ;",
      ].join("\n");
      const result = await compileStdinToArtifact(source);
      assertEquals(result.ok, false);
      if (result.ok) return;
      assertStringIncludes(result.error.message, "Expected");
      assertStringIncludes(result.error.message, "Capture");
      assertStringIncludes(result.error.message, "Into");
      assertStringIncludes(result.error.message, "e.g.");
      assertStringIncludes(result.error.message, '"not"');
      assertStringIncludes(result.error.message, '"["');
      assertStringIncludes(result.error.message, "Identifier");
      assertStringIncludes(result.error.message, 'Unexpected ")"');
      // The skipped declaration runs from `rule` through its `;`.
      assertEquals(result.error.location?.offset, source.indexOf("rule"));
      assertEquals(result.error.location?.endOffset, source.length);
    },
  );

  await t.step(
    "describes equal failures with expected value and rule context",
    async () => {
      const result = await compileStdinToArtifact("rule A = any");
      assertEquals(result.ok, false);
      if (result.ok) return;
      // Expected leads; the squiggle covers the skipped declaration.
      assertStringIncludes(result.error.message, "Expected");
      assertStringIncludes(result.error.message, ";");
      assertStringIncludes(result.error.message, "Unexpected");
      assertStringIncludes(result.error.message, "any");
      assertStringIncludes(result.error.message, "RuleDeclarationSyntax");
      assertEquals(result.error.location?.offset, 0);
      assertEquals(
        result.error.location?.endOffset,
        "rule A = any".length,
      );
    },
  );

  await t.step(
    "points incomplete CRLF input at the unexpected token offset",
    async () => {
      const source = "export Main;\r\nrule Main =";
      const result = await compileStdinToArtifact(source);

      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.error.location?.offset, source.indexOf("rule"));
      assertEquals(result.error.location?.endOffset, source.length);
      assertEquals(result.error.location?.line, 1);
      assertEquals(result.error.location?.column, 0);
    },
  );

  await t.step(
    "points mid-source pattern failures at an unexpected token",
    async () => {
      const source = "export Main; rule Main = !!!;";
      const result = await compileStdinToArtifact(source);

      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.error.location?.offset, source.indexOf("rule"));
      assertEquals(result.error.location?.endOffset, source.length);
      assertEquals(result.error.location?.line, 0);
      assertStringIncludes(result.error.message, "Expected");
      assertStringIncludes(result.error.message, "Unexpected");
    },
  );

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

  await t.step(
    "points incomplete expression failures at an unexpected token",
    async () => {
      const source = "[1 ";
      const result = await compileStdinToArtifact(
        source,
        CliLanguage.Expression,
      );

      assertEquals(result.ok, false);
      if (result.ok) return;
      // Underlines the `1` still awaiting a complete array element / closer.
      assertEquals(result.error.location?.offset, 1);
      assertStringIncludes(result.error.message, "Expected");
    },
  );

  await t.step(
    "success results include the raw Match alongside the AST",
    async () => {
      const result = await compileStdinToArtifact(
        "export Main; rule Main = any;",
      );

      assertEquals(result.ok, true);
      if (!result.ok) return;
      assertEquals(result.match.kind, MatchKind.Ok);
    },
  );

  await t.step(
    "reuses rehydrated memos and a fresh Input for an incremental re-parse",
    async () => {
      const before = 'rule First = "a"; rule Second = "b";';
      const prior = await parseSourceToAst(before);
      assertEquals(prior.ok, true);
      if (!prior.ok) return;

      const editAt = before.indexOf('"b"');
      const after = before.slice(0, editAt) + '"c"' +
        before.slice(editAt + 3);
      const freshInput = Input.From(after, {
        kind: InputNormalizationMode.Scalar,
      });
      const edit: Edit = {
        at: Path.Default().set(editAt),
        removed: 3,
        inserted: 3,
      };
      const memos = await rehydrateMemos(prior.match, edit, freshInput);

      const incremental = await parseSourceToAst(
        after,
        CliLanguage.FullUffda,
        "<stdin>",
        { memos, input: freshInput },
      );
      const full = await parseSourceToAst(after);

      assertEquals(incremental.ok, true);
      assertEquals(full.ok, true);
      if (incremental.ok && full.ok) {
        assertEquals(incremental.ast, full.ast);
      }
    },
  );
});

Deno.test("cli.stream reports parse diagnostics", async (t) => {
  await t.step("a failed parse lists its failure", async () => {
    const result = await parseSourceToAst(")", CliLanguage.Pattern);
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliStreamFailureCode.ParseFailure);
    assertEquals(result.diagnostics, [result.error]);
    assertEquals(result.ast, undefined);
  });

  await t.step(
    "a module missing a `;` keeps the declarations after it",
    async () => {
      const source = "rule A = a\nrule B = b;";
      const result = await parseSourceToAst(source);
      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.diagnostics.length, 1);
      assertEquals(result.error.code, CliStreamFailureCode.Recovered);
      assertEquals(
        source.slice(
          result.error.location?.offset,
          result.error.location?.endOffset,
        ),
        "rule A = a",
      );
      assertEquals(
        (result.ast as UffdaSyntaxModule).declarations.map((d) =>
          "name" in d ? d.name : d.kind
        ),
        ["B"],
      );
    },
  );

  await t.step("a broken rule body recovers inside the body", async () => {
    const source = "rule A = a -> { a: 1, b: ?, c: 2 };";
    const result = await parseSourceToAst(source);
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.diagnostics.length, 1);
    assertEquals(
      source.slice(
        result.error.location?.offset,
        result.error.location?.endOffset,
      ),
      "b: ?",
    );
    assertEquals((result.ast as UffdaSyntaxModule).declarations.length, 1);
  });

  await t.step("recoveries are ranged over the skipped source", async () => {
    const source = "ab;xx;ab;";
    const match = await executeUffdaSource(
      `export Main; rule Stmt = ope ("a" "b") sneak by until ";"; rule Main = (Stmt ";")* end;`,
      {
        entryRuleName: "Main",
        input: Input.From(source, { kind: InputNormalizationMode.Iterable }),
      },
    );
    const [failure] = await recoveryFailures(
      match,
      CliLanguage.FullUffda,
      "<stdin>",
      source,
    );
    assertEquals(failure.code, CliStreamFailureCode.Recovered);
    assertEquals(failure.location, {
      offset: 3,
      line: 0,
      column: 3,
      endOffset: 5,
    });
    assertEquals(failure.message, 'Expected "a"\nUnexpected "x"\nIn Stmt');
  });
});
