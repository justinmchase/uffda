import { assertEquals, assertStringIncludes } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import {
  CliStreamFailureCode,
  compileStdinToArtifact,
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
    assertEquals(
      result.error.location?.offset,
      "export Main; rule Main =".length,
    );
    assertStringIncludes(result.error.message, "while matching");
  });

  await t.step(
    "points incomplete CRLF input at the original source offset",
    async () => {
      const source = "export Main;\r\nrule Main =";
      const result = await compileStdinToArtifact(source);

      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.error.location?.offset, source.length);
      assertEquals(result.error.location?.line, 1);
      assertEquals(result.error.location?.column, "rule Main =".length);
    },
  );

  await t.step(
    "points mid-source pattern failures at the original token offset",
    async () => {
      const source = "export Main; rule Main = !!!;";
      const result = await compileStdinToArtifact(source);

      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.error.location?.offset, source.indexOf("!"));
      assertEquals(result.error.location?.line, 0);
      assertEquals(result.error.location?.column, source.indexOf("!"));
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
    "points incomplete expression failures at the original offset",
    async () => {
      const source = "[1 ";
      const result = await compileStdinToArtifact(
        source,
        CliLanguage.Expression,
      );

      assertEquals(result.ok, false);
      if (result.ok) return;
      assertEquals(result.error.location?.offset, 2);
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
