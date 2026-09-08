import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-029 - then/pipe/and/or .uff close B4 with std one",
  async () => {
    const thenSrc = await Deno.readTextFile(join(pattern, "then.uff"));
    assertEquals(thenSrc.includes("export Then"), true);
    assertEquals(thenSrc.includes('(one (flat _) "then")'), true);
    assertEquals(thenSrc.includes("patterns.length"), false);

    const pipeSrc = await Deno.readTextFile(join(pattern, "pipe.uff"));
    assertEquals(pipeSrc.includes("export Pipe"), true);
    assertEquals(pipeSrc.includes('(one (flat _) "pipeline" "steps")'), true);

    const andSrc = await Deno.readTextFile(join(pattern, "and.uff"));
    assertEquals(andSrc.includes("export And"), true);
    assertEquals(andSrc.includes('(one (flat _) "and")'), true);
    assertEquals(andSrc.includes("AndTail*"), true);

    const orSrc = await Deno.readTextFile(join(pattern, "or.uff"));
    assertEquals(orSrc.includes("export Or"), true);
    assertEquals(orSrc.includes('(one (flat _) "or")'), true);
    assertEquals(orSrc.includes('"|"?'), true);

    const projection = await Deno.readTextFile(join(pattern, "projection.ts"));
    assertEquals(projection.includes('moduleUrl: "./pipe.uff"'), true);

    const patternMod = await Deno.readTextFile(join(pattern, "pattern.ts"));
    assertEquals(patternMod.includes('moduleUrl: "./or.uff"'), true);

    const stdMod = await Deno.readTextFile(
      join(repoRoot, "src", "runtime", "std", "mod.ts"),
    );
    assertEquals(stdMod.includes('["one", one]'), true);
  },
);
