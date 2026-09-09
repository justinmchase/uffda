import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-035 - projection .uff source is converted",
  async () => {
    const projectionSrc = await Deno.readTextFile(
      join(pattern, "projection.uff"),
    );
    assertEquals(projectionSrc.includes("export Projection"), true);
    assertEquals(projectionSrc.includes('import "./pipe.uff" Pipe'), true);
    assertEquals(
      projectionSrc.includes(
        'import "../expression/expression.uff" Expression',
      ),
      true,
    );
    assertEquals(
      projectionSrc.includes(
        '{ kind: "projection", pattern: p, expression: t }',
      ),
      true,
    );
    assertEquals(
      projectionSrc.includes("p:Pipe t:ProjectionTail ->"),
      true,
    );
    assertEquals(projectionSrc.includes("ExpressionKind.Native"), false);
    assertEquals(projectionSrc.includes("ProjectionTail?"), false);

    const andSrc = await Deno.readTextFile(join(pattern, "and.uff"));
    assertEquals(andSrc.includes('import "./projection.uff" Projection'), true);
    assertEquals(andSrc.includes("projection.ts"), false);

    try {
      await Deno.stat(join(pattern, "projection.ts"));
      throw new Error("projection.ts twin must be deleted");
    } catch (error) {
      assertEquals(error instanceof Deno.errors.NotFound, true);
    }
  },
);
