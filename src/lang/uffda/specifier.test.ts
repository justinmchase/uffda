import { assertEquals } from "@std/assert";
import { ModuleSpecifierKind, parseModuleSpecifier } from "./specifier.ts";

Deno.test("lang.uffda.specifier parseModuleSpecifier", async (t) => {
  for (
    const [text, kind] of [
      ["./a.uff", ModuleSpecifierKind.Relative],
      ["../x/my-lang.v2.uff", ModuleSpecifierKind.Relative],
      ["@acme/kv", ModuleSpecifierKind.Name],
      ["@acme/kv/tokens", ModuleSpecifierKind.Name],
      ["jsr:@acme/kv", ModuleSpecifierKind.Jsr],
      ["jsr:@acme/kv@^1.2.0/tokens", ModuleSpecifierKind.Jsr],
    ] as const
  ) {
    await t.step(`reads ${text}`, async () => {
      assertEquals(await parseModuleSpecifier(text), { kind, text });
    });
  }

  for (
    const text of [
      "",
      "a",
      "/abs.uff",
      "./a b.uff",
      " ./a.uff",
      "./a.uff ",
      './a"b.uff',
      "./a\\b.uff",
      "./é.uff",
      "./",
      "https://jsr.io/@acme/kv",
    ]
  ) {
    await t.step(`rejects ${JSON.stringify(text)}`, async () => {
      assertEquals(await parseModuleSpecifier(text), undefined);
    });
  }
});
