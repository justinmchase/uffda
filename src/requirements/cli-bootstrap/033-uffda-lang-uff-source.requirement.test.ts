import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const uffdaDir = join(repoRoot, "src", "lang", "uffda");

Deno.test(
  "req:cli-bootstrap-033 - uffda.lang .uff source is converted",
  async () => {
    const uff = await Deno.readTextFile(join(uffdaDir, "uffda.lang.uff"));
    assertEquals(uff.includes("export UffdaLang"), true);
    assertEquals(uff.includes("rule ModuleBody"), true);
    assertEquals(uff.includes("rule UffdaLang"), true);
    assertEquals(
      uff.includes('{ kind: "module", declarations: (flat [i (flat e) r]) }'),
      true,
    );
    assertEquals(uff.includes("[ModuleBody]"), true);
    assertEquals(uff.includes("ExpressionKind.Native"), false);

    const helper = await Deno.readTextFile(join(uffdaDir, "uffda.lang.ts"));
    assertEquals(helper.includes("export async function uffdaGrammar"), true);
    assertEquals(helper.includes('"./uffda.lang.uff"'), true);
    assertEquals(helper.includes("ModuleDeclaration"), false);
    assertEquals(helper.includes("ExportDeclarationKind"), false);
  },
);
