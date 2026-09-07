import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-bootstrap-015 - compile:cli embeds ./bin via deno compile --include",
  async () => {
    const denoJson = await Deno.readTextFile(join(repoRoot, "deno.jsonc"));
    assertEquals(
      denoJson.includes("deno task compile:lang && deno run"),
      true,
    );
    assertEquals(denoJson.includes("bake:lang"), false);

    const compileCli = await Deno.readTextFile(
      join(repoRoot, "scripts", "compile-cli.ts"),
    );
    assertEquals(compileCli.includes('"--include"'), true);
    assertEquals(compileCli.includes('"./bin"'), true);

    const grammar = await Deno.readTextFile(
      join(repoRoot, "src", "lang", "grammar.ts"),
    );
    assertEquals(grammar.includes("languageArtifactRoots"), true);

    const roots = await Deno.readTextFile(
      join(
        repoRoot,
        "src",
        "runtime",
        "resolvers",
        "language_artifact_roots.ts",
      ),
    );
    assertEquals(roots.includes("Deno.build.standalone"), true);
  },
);
