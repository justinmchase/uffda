import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-023 - primary/unary/expression/atoms .uff sources are converted",
  async () => {
    const expression = join(repoRoot, "src", "lang", "expression");
    const pattern = join(repoRoot, "src", "lang", "pattern");

    const primary = await Deno.readTextFile(join(expression, "primary.uff"));
    assertEquals(primary.includes("export Primary"), true);
    assertEquals(primary.includes('import "./member.uff" Member'), true);
    assertEquals(primary.includes('import "./string.ts" String'), true);

    const unary = await Deno.readTextFile(join(expression, "unary.uff"));
    assertEquals(unary.includes("export Unary"), true);
    assertEquals(unary.includes('import "./primary.uff" Primary'), true);
    assertEquals(unary.includes('import "./not.uff" Not'), true);

    const expressionMod = await Deno.readTextFile(
      join(expression, "expression.uff"),
    );
    assertEquals(expressionMod.includes("export Expression"), true);
    assertEquals(expressionMod.includes('import "./unary.uff" Unary'), true);
    assertEquals(expressionMod.includes("rule Expression = Unary"), true);

    const atoms = await Deno.readTextFile(join(pattern, "atoms.uff"));
    assertEquals(atoms.includes("export Atoms"), true);
    assertEquals(atoms.includes('-> { kind: "any" }'), true);
    assertEquals(atoms.includes('-> { kind: "end" }'), true);
  },
);
