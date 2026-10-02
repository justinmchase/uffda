import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { uffExportNames } from "../uff_exports.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-023 - primary/unary/expression/atoms .uff sources are converted",
  async () => {
    const expression = join(repoRoot, "src", "lang", "expression");
    const pattern = join(repoRoot, "src", "lang", "pattern");

    const primary = await Deno.readTextFile(join(expression, "primary.uff"));
    assertEquals(
      (await uffExportNames(join(expression, "primary.uff"))).includes(
        "Primary",
      ),
      true,
    );
    assertEquals(primary.includes('import "./member.uff" Member'), true);
    assertEquals(primary.includes('import "./string.uff" String'), true);

    const unary = await Deno.readTextFile(join(expression, "unary.uff"));
    assertEquals(
      (await uffExportNames(join(expression, "unary.uff"))).includes("Unary"),
      true,
    );
    assertEquals(unary.includes('import "./primary.uff" Primary'), true);
    assertEquals(unary.includes('import "./not.uff" Not'), true);

    const expressionMod = await Deno.readTextFile(
      join(expression, "expression.uff"),
    );
    assertEquals(
      (await uffExportNames(join(expression, "expression.uff"))).includes(
        "Expression",
      ),
      true,
    );
    assertEquals(expressionMod.includes('import "./unary.uff" Unary'), true);
    assertEquals(expressionMod.includes("rule Expression = Unary"), true);

    const atoms = await Deno.readTextFile(join(pattern, "atoms.uff"));
    assertEquals(
      (await uffExportNames(join(pattern, "atoms.uff"))).includes("Atoms"),
      true,
    );
    assertEquals(atoms.includes('-> { kind: "any" }'), true);
    assertEquals(atoms.includes('-> { kind: "end" }'), true);
  },
);
