import { assert, assertEquals, assertThrows } from "@std/assert";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import {
  nameOccurrences,
  type NameSymbol,
  NameSymbolKind,
  sameSymbol,
} from "./lsp.symbols.ts";

const MODULE_URL = "file:///w/main.uff";
const SOURCE = `import "./dep.uff" Dep;
export Main Pair;
rule Pair<P> = a:P b:P -> [a b];
rule Main = n:string Dep -> (join (map [n] <x:any> -> (f x n)) ",");
[Loud]
decorator Loud = { shout: true };`;

async function occurrences(name?: string) {
  const match = await uffdaGrammar(SOURCE);
  return nameOccurrences(
    MODULE_URL,
    SOURCE,
    match,
    new Set(["join", "map"]),
    name,
  ).map((o) => ({
    text: SOURCE.slice(o.start, o.end),
    declaration: o.declaration,
    symbol: o.symbol,
  }));
}

const declaration = (name: string, moduleUrl = MODULE_URL): NameSymbol => ({
  kind: NameSymbolKind.Declaration,
  moduleUrl,
  name,
});

Deno.test("cli.lsp.symbols nameOccurrences", async (t) => {
  await t.step("an import resolves to its target module", async () => {
    const dep = declaration("Dep", "file:///w/dep.uff");
    assertEquals(await occurrences("Dep"), [
      { text: "Dep", declaration: false, symbol: dep },
      { text: "Dep", declaration: false, symbol: dep },
    ]);
  });

  await t.step("a declaration's name, export, and references", async () => {
    assertEquals(await occurrences("Pair"), [
      { text: "Pair", declaration: false, symbol: declaration("Pair") },
      { text: "Pair", declaration: true, symbol: declaration("Pair") },
    ]);
    assertEquals(
      (await occurrences("Loud")).map((o) => o.declaration),
      [false, true],
    );
  });

  await t.step("rule parameters bind their references", async () => {
    const found = await occurrences("P");
    assertEquals(found.map((o) => o.declaration), [true, false, false]);
    assert(found.every((o) => sameSymbol(o.symbol, found[0].symbol)));
    assertEquals(found[0].symbol.kind, NameSymbolKind.Local);
  });

  await t.step(
    "captures and lambda parameters are distinct locals",
    async () => {
      const n = await occurrences("n");
      assertEquals(n.map((o) => o.declaration), [true, false, false]);
      assert(n.every((o) => sameSymbol(o.symbol, n[0].symbol)));
      const x = await occurrences("x");
      assertEquals(x.map((o) => o.declaration), [true, false]);
      assert(!sameSymbol(x[0].symbol, n[0].symbol));
    },
  );

  await t.step("globals resolve where a func may be named", async () => {
    assertEquals(await occurrences("join"), [
      {
        text: "join",
        declaration: false,
        symbol: { kind: NameSymbolKind.Global, name: "join" },
      },
    ]);
  });

  await t.step("unresolved names denote nothing", async () => {
    assertEquals(await occurrences("f"), []);
    assertEquals(await occurrences("shout"), []);
  });
});

Deno.test("cli.lsp.symbols sameSymbol", () => {
  assert(sameSymbol(declaration("A"), declaration("A")));
  assert(!sameSymbol(declaration("A"), declaration("A", "file:///w/b.uff")));
  assert(
    !sameSymbol(declaration("A"), { kind: NameSymbolKind.Global, name: "A" }),
  );
  assert(
    sameSymbol(
      { kind: NameSymbolKind.Local, key: "k" },
      { kind: NameSymbolKind.Local, key: "k" },
    ),
  );
  assertThrows(() =>
    sameSymbol({ kind: "other" } as unknown as NameSymbol, declaration("A"))
  );
});
