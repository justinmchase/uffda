import { assertEquals, assertStringIncludes } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import {
  CliStreamFailureCode,
  compileStdinToArtifact,
  parseFailureLocation,
  parseSourceToAst,
} from "./stream.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { Path } from "../path.ts";
import type { Edit } from "../edit.ts";
import { rehydrateMemos } from "../runtime/incremental.ts";
import { MatchKind } from "../match.ts";

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
      const source = "export Main;\nrule Main = ( any ;";
      const parsed = await parseSourceToAst(source, CliLanguage.FullUffda, "t");
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
    assertEquals(result.error.code, CliStreamFailureCode.ParseFailure);
    assertEquals(result.error.phase, "parse");
    assertEquals(result.error.sourcePath, "<stdin>");
    assertEquals(result.error.language, CliLanguage.FullUffda);
    assertEquals(result.error.location?.line, 0);
    // Points at the unexpected "=" token (pattern body still required after it).
    assertEquals(
      result.error.location?.offset,
      "export Main; rule Main ".length,
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
      // Squiggle on `)`, immediately after the incomplete `|>`, not the final `;`.
      assertEquals(result.error.location?.offset, source.lastIndexOf(")"));
      assertEquals(
        result.error.location?.endOffset,
        source.lastIndexOf(")") + 1,
      );
    },
  );

  await t.step(
    "describes equal failures with expected value and rule context",
    async () => {
      const result = await compileStdinToArtifact("rule A = any");
      assertEquals(result.ok, false);
      if (result.ok) return;
      // Expected leads; squiggle covers "any".
      assertStringIncludes(result.error.message, "Expected");
      assertStringIncludes(result.error.message, ";");
      assertStringIncludes(result.error.message, "Unexpected");
      assertStringIncludes(result.error.message, "any");
      assertStringIncludes(result.error.message, "RuleDeclarationSyntax");
      assertEquals(result.error.location?.offset, "rule A = ".length);
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
      assertEquals(result.error.location?.offset, source.lastIndexOf("="));
      assertEquals(result.error.location?.endOffset, source.length);
      assertEquals(result.error.location?.line, 1);
      assertEquals(result.error.location?.column, "rule Main ".length);
    },
  );

  await t.step(
    "points mid-source pattern failures at an unexpected token",
    async () => {
      const source = "export Main; rule Main = !!!;";
      const result = await compileStdinToArtifact(source);

      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.error.location !== undefined, true);
      assertEquals(
        (result.error.location?.offset ?? -1) >= source.indexOf("!"),
        true,
      );
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
