import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-027 - import.rules .uff source is converted",
  async () => {
    const importRules = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "import.rules.uff"),
    );
    assertEquals(importRules.includes("export ImportDeclarationSyntax"), true);
    assertEquals(importRules.includes("export ImportNameList"), true);
    assertEquals(importRules.includes("export ImportModuleSpecifier"), true);
    assertEquals(importRules.includes('(join p "")'), true);
    assertEquals(importRules.includes("(flat _)"), true);
    assertEquals(
      importRules.includes('{ kind: "import", moduleUrl: m, names: n }'),
      true,
    );
    assertEquals(importRules.includes("ExpressionKind.Native"), false);

    const uffdaLang = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "uffda.lang.uff"),
    );
    assertEquals(
      uffdaLang.includes('import "./import.rules.uff" ImportDeclarationSyntax'),
      true,
    );
    assertEquals(
      uffdaLang.includes('import "./import.rules.ts"'),
      false,
    );
  },
);
