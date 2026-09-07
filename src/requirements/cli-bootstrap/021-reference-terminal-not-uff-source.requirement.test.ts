import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const expression = join(repoRoot, "src", "lang", "expression");

Deno.test(
  "req:cli-bootstrap-021 - reference/terminal/not .uff sources are converted",
  async () => {
    const reference = await Deno.readTextFile(
      join(expression, "reference.uff"),
    );
    assertEquals(reference.includes("export Reference"), true);
    assertEquals(reference.includes("string & [Identifier]"), true);
    assertEquals(
      reference.includes('-> { kind: "reference", name: _ }'),
      true,
    );

    const terminal = await Deno.readTextFile(join(expression, "terminal.uff"));
    assertEquals(terminal.includes("export Terminal"), true);
    assertEquals(terminal.includes('import "./number.ts" Number'), true);
    assertEquals(terminal.includes('import "./reference.uff" Reference'), true);
    assertEquals(terminal.includes("Token<Number>"), true);
    assertEquals(terminal.includes("Token<Reference>"), true);

    const not = await Deno.readTextFile(join(expression, "not.uff"));
    assertEquals(not.includes("export Not"), true);
    assertEquals(not.includes('import "./primary.ts" Primary'), true);
    assertEquals(not.includes("e:Token<Primary>"), true);
    assertEquals(not.includes('-> { kind: "not", expression: e }'), true);
  },
);
