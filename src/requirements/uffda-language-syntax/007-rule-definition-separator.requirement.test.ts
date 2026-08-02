import { assertEquals } from "@std/assert";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { MatchKind } from "../../match.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";

Deno.test("req:uffda-language-syntax-007 - rule declarations require an equals separator", async () => {
  const match = await uffdaGrammar("rule Main = any -> 1;");
  const bare = await uffdaGrammar("rule Main any -> 1;");

  assertEquals(match.kind, MatchKind.Ok);
  if (match.kind === MatchKind.Ok) {
    assertEquals(match.value.declarations, [{
      kind: "rule",
      name: "Main",
      pattern: { kind: PatternKind.Any },
      projection: { kind: ExpressionKind.Number, value: 1 },
    }]);
  }
  assertEquals(bare.kind, MatchKind.Fail);
});
