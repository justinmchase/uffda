import { assertEquals } from "@std/assert";
import { MatchKind } from "../../mod.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";

Deno.test(
  "req:uffda-language-syntax-011 - multi-rule modules accept quoted backslash",
  async () => {
    const patternThenOther = await uffdaGrammar(
      'rule Slash = "\\\\"; rule Other = "x" -> { kind: "ok" };',
    );
    assertEquals(patternThenOther.kind, MatchKind.Ok);

    const projectionThenOther = await uffdaGrammar(
      'rule A = any -> "\\\\"; rule B = "x";',
    );
    assertEquals(projectionThenOther.kind, MatchKind.Ok);

    const sameRule = await uffdaGrammar('rule A = "\\\\" -> "\\\\";');
    assertEquals(sameRule.kind, MatchKind.Ok);
  },
);
