import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-028 - export.rules .uff source is converted",
  async () => {
    const exportRules = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "export.rules.uff"),
    );
    assertEquals(exportRules.includes("export ExportDeclarationSyntax"), true);
    assertEquals(exportRules.includes("export ExportNameList"), true);
    assertEquals(exportRules.includes("rule ExportName"), true);
    assertEquals(exportRules.includes("(flat _)"), true);
    assertEquals(
      exportRules.includes('(pack { kind: "export", name: r.name } r)'),
      true,
    );
    assertEquals(exportRules.includes(".map"), false);
    assertEquals(exportRules.includes("ExpressionKind.Native"), false);

    const uffdaLang = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "uffda.lang.uff"),
    );
    assertEquals(
      uffdaLang.includes('import "./export.rules.uff" ExportDeclarationSyntax'),
      true,
    );
    assertEquals(
      uffdaLang.includes('import "./export.rules.ts"'),
      false,
    );
  },
);
