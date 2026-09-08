import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-031 - pattern.lang .uff source is converted",
  async () => {
    const uff = await Deno.readTextFile(join(pattern, "pattern.lang.uff"));
    assertEquals(uff.includes("export PatternLang"), true);
    assertEquals(uff.includes("export PatternTokens"), true);
    assertEquals(uff.includes("rule PatternComplete"), true);
    assertEquals(uff.includes("p:Pattern"), true);
    assertEquals(uff.includes("rule PatternTokens = [PatternComplete]"), true);
    assertEquals(
      uff.includes("Source") && uff.includes("TokenizerNoWhitespace"),
      true,
    );
    assertEquals(uff.includes("[PatternComplete]"), true);

    const helper = await Deno.readTextFile(join(pattern, "pattern.lang.ts"));
    assertEquals(helper.includes("export async function patternGrammar"), true);
    assertEquals(
      helper.includes('"./pattern.lang.uff"'),
      true,
    );
    assertEquals(helper.includes("ModuleDeclaration"), false);
    assertEquals(helper.includes("ExportDeclarationKind"), false);

    const ruleRules = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "rule.rules.ts"),
    );
    assertEquals(
      ruleRules.includes('moduleUrl: "../pattern/pattern.lang.uff"'),
      true,
    );
  },
);
