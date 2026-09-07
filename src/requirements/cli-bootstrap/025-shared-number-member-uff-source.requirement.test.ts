import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-025 - shared/number .uff sources are converted",
  async () => {
    const shared = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "shared.rules.uff"),
    );
    assertEquals(shared.includes("export IdentifierToken"), true);
    assertEquals(shared.includes("export ReservedKeywordToken"), true);
    assertEquals(shared.includes("& (not ReservedKeywordToken)"), true);

    const number = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "expression", "number.uff"),
    );
    assertEquals(number.includes("export Number"), true);
    assertEquals(number.includes('(int (join (flat _) ""))'), true);
  },
);
