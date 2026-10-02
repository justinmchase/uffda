import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));
const pattern = join(repoRoot, "src", "lang", "pattern");

Deno.test(
  "req:cli-bootstrap-029 - then/pipe/and/or .uff close B4 with std one",
  async () => {
    const thenSrc = await Deno.readTextFile(join(pattern, "then.uff"));
    assertEquals(thenSrc.includes("export Then"), true);
    assertEquals(
      thenSrc.includes('(one m { kind: "then", patterns: m })'),
      true,
    );
    assertEquals(thenSrc.includes("patterns.length"), false);

    const pipeSrc = await Deno.readTextFile(join(pattern, "pipe.uff"));
    assertEquals(pipeSrc.includes("export Pipe"), true);
    assertEquals(
      pipeSrc.includes(
        '(one m { kind: "pipeline", steps: m })',
      ),
      true,
    );
    assertEquals(pipeSrc.includes('("|" ">")?'), true);

    const andSrc = await Deno.readTextFile(join(pattern, "and.uff"));
    assertEquals(andSrc.includes("export And"), true);
    assertEquals(
      andSrc.includes('(one m { kind: "and", patterns: m })'),
      true,
    );
    assertEquals(andSrc.includes("AndTail*"), true);
    assertEquals(andSrc.includes('import "./projection.uff" Projection'), true);

    const orSrc = await Deno.readTextFile(join(pattern, "or.uff"));
    assertEquals(orSrc.includes("export Or"), true);
    assertEquals(
      orSrc.includes('(one m { kind: "or", patterns: m })'),
      true,
    );
    assertEquals(orSrc.includes('("|" not ">")?'), true);

    const patternMod = await Deno.readTextFile(join(pattern, "pattern.uff"));
    assertEquals(patternMod.includes('import "./or.uff" Or'), true);

    const stdMod = await Deno.readTextFile(
      join(repoRoot, "src", "runtime", "globals", "mod.ts"),
    );
    assertEquals(stdMod.includes('["one", one]'), true);
  },
);
