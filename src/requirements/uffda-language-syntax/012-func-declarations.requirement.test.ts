import { assertEquals } from "@std/assert";
import { compileUffdaSyntaxModule } from "../../lang/uffda/execute.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";

Deno.test("req:uffda-language-syntax-012 - func declarations parse and lower", async () => {
  const parsed = await uffdaGrammar("func Double<a:number> = (add a a);");
  assertEquals(parsed.kind, MatchKind.Ok);
  if (parsed.kind !== MatchKind.Ok) return;

  const lowered = await compileUffdaSyntaxModule(parsed.value);
  assertEquals(lowered.funcs?.length, 1);
  assertEquals(lowered.funcs?.[0].name, "Double");
  assertEquals(lowered.funcs?.[0].pattern.kind, PatternKind.Variable);
  assertEquals(lowered.funcs?.[0].expression.kind, ExpressionKind.Invocation);
  assertEquals(lowered.rules, []);
});

Deno.test("req:uffda-language-syntax-012 - multi-param list is Then of captures", async () => {
  const parsed = await uffdaGrammar("func Pair<a:number b:string> = a;");
  assertEquals(parsed.kind, MatchKind.Ok);
  if (parsed.kind !== MatchKind.Ok) return;

  const lowered = await compileUffdaSyntaxModule(parsed.value);
  const pattern = lowered.funcs?.[0].pattern;
  assertEquals(pattern?.kind, PatternKind.Then);
  if (pattern?.kind === PatternKind.Then) {
    assertEquals(pattern.patterns.length, 2);
    assertEquals(pattern.patterns[0].kind, PatternKind.Variable);
    assertEquals(pattern.patterns[1].kind, PatternKind.Variable);
  }
});

Deno.test("req:uffda-language-syntax-012 - export func normalizes like split export", async () => {
  const inline = await uffdaGrammar("export func Id<a:any> = a;");
  const split = await uffdaGrammar("export Id; func Id<a:any> = a;");
  assertEquals(inline.kind, MatchKind.Ok);
  assertEquals(split.kind, MatchKind.Ok);
  if (inline.kind !== MatchKind.Ok || split.kind !== MatchKind.Ok) return;

  assertEquals(inline.value, split.value);

  const lowered = await compileUffdaSyntaxModule(inline.value);
  assertEquals(lowered.exports, [{
    kind: ExportDeclarationKind.Func,
    name: "Id",
  }]);
  assertEquals(lowered.funcs?.[0].name, "Id");
});
