import { assertEquals } from "@std/assert";
import { expressionGrammar } from "../lang/expression/expression.lang.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { MatchKind } from "../match.ts";
import {
  CliExecFailureCode,
  executeCliAst,
  executeCliExpression,
  executeCliModule,
  parseCliAst,
} from "./exec.ts";

Deno.test("cli.exec executes raw module and expression AST inputs", async (t) => {
  await t.step("executes a raw Uffda module AST", async () => {
    const parsed = await uffdaGrammar("export Main; rule Main = ok -> 1;");
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await executeCliAst(parsed.value);
    assertEquals(result, { ok: true, value: 1 });
  });

  await t.step("executes a raw expression AST with echo", async () => {
    const parsed = await expressionGrammar('(echo "hello")');
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await executeCliExpression(parsed.value);
    assertEquals(result, { ok: true, value: "hello" });
  });

  await t.step("runs a raw Uffda module AST by entry rule", async () => {
    const parsed = await uffdaGrammar(
      "export Main; export Other; rule Main = ok -> 1; rule Other = ok -> 2;",
    );
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const result = await executeCliModule(parsed.value, "Other");
    assertEquals(result, { ok: true, value: 2 });
  });

  await t.step("rejects malformed AST input", async () => {
    const result = await executeCliAst({ kind: "or" });
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliExecFailureCode.UnsupportedAst);
  });

  await t.step("reports invalid JSON", () => {
    const result = parseCliAst("{");
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.error.code, CliExecFailureCode.InvalidJson);
  });
});
