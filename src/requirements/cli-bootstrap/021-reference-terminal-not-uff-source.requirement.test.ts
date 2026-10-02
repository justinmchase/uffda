import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { uffExportNames } from "../uff_exports.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const expression = join(repoRoot, "src", "lang", "expression");

Deno.test(
  "req:cli-bootstrap-021 - reference/terminal/not .uff sources are converted",
  async () => {
    const reference = await Deno.readTextFile(
      join(expression, "reference.uff"),
    );
    assertEquals(
      (await uffExportNames(join(expression, "reference.uff"))).includes(
        "Reference",
      ),
      true,
    );
    assertEquals(
      reference.includes('import "../common/identifier.uff" IdToken'),
      true,
    );
    assertEquals(reference.includes("IdToken"), true);
    assertEquals(
      reference.includes('-> { kind: "reference", name: _ }'),
      true,
    );

    const terminal = await Deno.readTextFile(join(expression, "terminal.uff"));
    assertEquals(
      (await uffExportNames(join(expression, "terminal.uff"))).includes(
        "Terminal",
      ),
      true,
    );
    assertEquals(terminal.includes('import "./number.uff" Number'), true);
    assertEquals(terminal.includes('import "./reference.uff" Reference'), true);
    assertEquals(terminal.includes("Token<Number>"), true);
    assertEquals(terminal.includes("Token<Reference>"), true);

    const not = await Deno.readTextFile(join(expression, "not.uff"));
    assertEquals(
      (await uffExportNames(join(expression, "not.uff"))).includes("Not"),
      true,
    );
    assertEquals(not.includes('import "./primary.uff" Primary'), true);
    assertEquals(not.includes("e:Token<Primary>"), true);
    assertEquals(not.includes('-> { kind: "not", expression: e }'), true);
  },
);
