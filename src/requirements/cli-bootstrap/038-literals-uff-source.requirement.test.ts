import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-038 - literals/character_class .uff source",
  async () => {
    const literalsSrc = await Deno.readTextFile(join(pattern, "literals.uff"));
    assertEquals(literalsSrc.includes("export Literals"), true);
    assertEquals(
      literalsSrc.includes('import "./character_class.uff" CharacterClass'),
      true,
    );
    assertEquals(literalsSrc.includes("rule BetweenClosed"), true);
    assertEquals(literalsSrc.includes("rule BetweenOpenUpper"), true);
    assertEquals(literalsSrc.includes("rule BetweenOpenLower"), true);
    assertEquals(literalsSrc.includes("rule IncludesPattern"), true);
    assertEquals(literalsSrc.includes("rule BareLiteralPattern"), true);
    assertEquals(literalsSrc.includes("ExpressionKind.Native"), false);
    assertEquals(literalsSrc.includes("fn:"), false);

    const characterSrc = await Deno.readTextFile(
      join(pattern, "character_class.uff"),
    );
    assertEquals(characterSrc.includes("export CharacterClass"), true);
    assertEquals(characterSrc.includes("rule CharacterClassNd"), true);
    assertEquals(
      characterSrc.includes('{ kind: "character", characterClass: "Nd" }'),
      true,
    );

    const atomicSrc = await Deno.readTextFile(join(pattern, "atomic.uff"));
    assertEquals(atomicSrc.includes('import "./literals.uff" Literals'), true);
    assertEquals(atomicSrc.includes("literals.ts"), false);

    try {
      await Deno.stat(join(pattern, "literals.ts"));
      throw new Error("literals.ts twin must be deleted");
    } catch (error) {
      assertEquals(error instanceof Deno.errors.NotFound, true);
    }
  },
);
