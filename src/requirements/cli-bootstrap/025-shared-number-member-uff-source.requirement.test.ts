import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { uffExportNames } from "../uff_exports.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-025 - shared/number .uff sources are converted",
  async () => {
    const shared = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "uffda", "shared.rules.uff"),
    );
    assertEquals(
      (await uffExportNames(
        join(repoRoot, "src", "lang", "uffda", "shared.rules.uff"),
      )).includes("IdentifierToken"),
      true,
    );
    assertEquals(
      (await uffExportNames(
        join(repoRoot, "src", "lang", "uffda", "shared.rules.uff"),
      )).includes("ReservedKeywordToken"),
      true,
    );
    assertEquals(shared.includes("not ReservedKeywordToken & IdToken"), true);
    assertEquals(shared.includes("IdToken"), true);

    const number = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "expression", "number.uff"),
    );
    assertEquals(
      (await uffExportNames(
        join(repoRoot, "src", "lang", "expression", "number.uff"),
      )).includes("Number"),
      true,
    );
    assertEquals(number.includes('(int (join (flat _) ""))'), true);
  },
);
