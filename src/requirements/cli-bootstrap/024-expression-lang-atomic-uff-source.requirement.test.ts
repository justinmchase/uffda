import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-024 - expression.lang and atomic .uff sources are converted",
  async () => {
    const expressionLang = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "expression", "expression.lang.uff"),
    );
    assertEquals(expressionLang.includes("export ExpressionLang"), true);
    assertEquals(expressionLang.includes("export ExpressionTokens"), true);
    assertEquals(expressionLang.includes("|> [TokenizerNoWhitespace]"), true);
    assertEquals(expressionLang.includes("|> [ExpressionComplete]"), true);
    assertEquals(expressionLang.includes("e:Expression"), true);

    const helper = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "expression", "expression.lang.ts"),
    );
    assertEquals(helper.includes("expressionGrammar"), true);
    assertEquals(helper.includes("./expression.lang.uff"), true);
    assertEquals(helper.includes("ModuleDeclaration"), false);

    const atomic = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "pattern", "atomic.uff"),
    );
    assertEquals(atomic.includes("export Atomic"), true);
    assertEquals(atomic.includes('import "./atoms.uff" Atoms'), true);
  },
);
