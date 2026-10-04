import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";

Deno.test(
  "req:uffda-language-syntax-017 - import module specifiers are parsed by the grammar",
  async (t) => {
    for (
      const specifier of [
        "./tokens.uff",
        "../common/identifier.uff",
        "@acme/kv",
        "@acme/kv/tokens",
        "jsr:@acme/kv",
        "jsr:@acme/kv@^1.2.0/tokens",
      ]
    ) {
      await t.step(`accepts ${specifier}`, async () => {
        const match = await uffdaGrammar(`import "${specifier}" A;`);
        assert(isSuccess(match) && isClean(match));
        assertEquals(valueOf(match).declarations, [
          { kind: "import", moduleUrl: specifier, names: ["A"] },
        ]);
      });
    }
    for (
      const specifier of [
        "",
        "tokens.uff",
        "/abs.uff",
        "https://jsr.io/@acme/kv",
        "./a b.uff",
        "./é.uff",
        "./a/../b.uff",
        "jsr:@acme",
      ]
    ) {
      await t.step(`rejects ${JSON.stringify(specifier)}`, async () => {
        const match = await uffdaGrammar(`import "${specifier}" A;`);
        assertEquals(isClean(match), false);
      });
    }
  },
);
