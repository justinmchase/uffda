import { assert, assertEquals } from "@std/assert";
import { uffdaGrammar } from "./uffda.lang.ts";
import { isClean, isSuccess, valueOf } from "../../match.ts";
import { explainedMistakesTest } from "../../test.ts";

const importOf = (specifier: string) => `import "${specifier}" A;`;

Deno.test("lang.uffda.specifier-rules accepts module specifiers", async (t) => {
  for (
    const specifier of [
      "./a.uff",
      "./tokens.uff",
      "./.hidden.uff",
      "./..x/...y.uff",
      "../common/identifier.uff",
      "../../x/my-lang.v2.uff",
      "./a_b/c-d/E9.uff",
      "@acme",
      "@acme/kv",
      "@acme/kv/tokens",
      "jsr:@acme/kv",
      "jsr:@acme/kv/tokens",
      "jsr:@acme/kv@1",
      "jsr:@acme/kv@^1.2.0",
      "jsr:@acme/kv@~1.2.0-pre.1/tokens",
      "jsr:@acme/kv@>=1.0.0<2.0.0",
    ]
  ) {
    await t.step(specifier, async () => {
      const match = await uffdaGrammar(importOf(specifier));
      assert(isSuccess(match) && isClean(match));
      assertEquals(valueOf(match).declarations, [
        { kind: "import", moduleUrl: specifier, names: ["A"] },
      ]);
    });
  }
});

Deno.test("lang.uffda.specifier-rules rejects other text", async (t) => {
  for (
    const specifier of [
      "",
      "tokens.uff",
      "a",
      "/abs.uff",
      "https://jsr.io/@acme/kv/tokens.uff",
      "npm:kv",
      "file:///a.uff",
      "./a b.uff",
      "./a\\b.uff",
      "./é.uff",
      "./",
      "../",
      "./../a.uff",
      "./a//b.uff",
      "./a/./b.uff",
      "./a/../b.uff",
      "./a/..",
      "@",
      "@acme/",
      "jsr:acme/kv",
      "jsr:@acme",
      "jsr:@acme/kv@",
    ]
  ) {
    await t.step(JSON.stringify(specifier), async () => {
      const match = await uffdaGrammar(importOf(specifier));
      assertEquals(isClean(match), false);
    });
  }
});

Deno.test(
  "lang.uffda.specifier-rules explains mistakes where they occur",
  explainedMistakesTest([
    ['import "‸tokens.uff" A;', "A module is named by a relative path"],
    ['import "‸/abs.uff" A;', "A module is named by a relative path"],
    ['import "‸https://x/a.uff" A;', "A module is named by a relative path"],
    ['import "‸" A;', "A module is named by a relative path"],
    ['import "./‸" A;', "Expected a path segment here"],
    ['import "./‸é.uff" A;', "Expected a path segment here"],
    ['import "./‸../a.uff" A;', "Expected a path segment here"],
    ['import "./a/‸/b.uff" A;', "Expected a path segment here"],
    ['import "./a/‸./b.uff" A;', "Expected a path segment here"],
    ['import "./a/‸.." A;', "Expected a path segment here"],
    ['import "@‸" A;', "Expected a path segment here"],
    ['import "jsr:‸acme/kv" A;', "A `jsr:` specifier names a package"],
    ['import "jsr:@acme‸" A;', "Expected `/` and the package name"],
    ['import "jsr:@acme/kv@‸" A;', "Expected a version range after `@`"],
  ]),
);
