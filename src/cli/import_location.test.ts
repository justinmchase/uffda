import { assert, assertEquals } from "@std/assert";
import { CliLanguage } from "./contract.ts";
import { importFrameLocation } from "./import_location.ts";
import { parseSourceToAst } from "./stream.ts";

const SOURCE = [
  'import "./a.uff" A;',
  'import   "./b.uff" B;',
  "",
  "export X;",
  "rule X = A B;",
].join("\n");

function frame(importIndex: number, moduleUrl: string) {
  return {
    importerUrl: "file:///main.uff",
    importIndex,
    moduleUrl,
    resolvedUrl: new URL(moduleUrl, "file:///main.uff").href,
  };
}

Deno.test("cli.import_location", async (t) => {
  const parsed = await parseSourceToAst(SOURCE, CliLanguage.FullUffda, "t");
  assert(parsed.ok);

  await t.step("locates the specifier of the indexed import", () => {
    const location = importFrameLocation(
      parsed.match,
      SOURCE,
      frame(1, "./b.uff"),
    );
    assert(location);
    assertEquals(location.line, 1);
    assertEquals(
      SOURCE.slice(location.offset, location.endOffset),
      '"./b.uff"',
    );
  });

  await t.step("falls back to the first import with that specifier", () => {
    const location = importFrameLocation(
      parsed.match,
      SOURCE,
      frame(7, "./a.uff"),
    );
    assert(location);
    assertEquals(location.line, 0);
    assertEquals(
      SOURCE.slice(location.offset, location.endOffset),
      '"./a.uff"',
    );
  });

  await t.step("locates a named import when the frame names one", () => {
    const location = importFrameLocation(parsed.match, SOURCE, {
      ...frame(1, "./b.uff"),
      name: "B",
    });
    assert(location);
    assertEquals(location.line, 1);
    assertEquals(SOURCE.slice(location.offset, location.endOffset), "B");
  });

  await t.step("falls back to the specifier for an unlisted name", () => {
    const location = importFrameLocation(parsed.match, SOURCE, {
      ...frame(0, "./a.uff"),
      name: "Missing",
    });
    assert(location);
    assertEquals(
      SOURCE.slice(location.offset, location.endOffset),
      '"./a.uff"',
    );
  });

  await t.step("returns undefined when no import matches", () => {
    assertEquals(
      importFrameLocation(parsed.match, SOURCE, frame(0, "./c.uff")),
      undefined,
    );
  });
});
