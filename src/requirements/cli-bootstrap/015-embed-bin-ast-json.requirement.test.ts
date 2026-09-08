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

    const checks = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );
    // Prefer latest; allow a pinned published SemVer when latest cannot compile
    // the current tree (bootstrap chicken-egg after a bad release).
    assertEquals(
      /version:\s*(latest|"?\d+\.\d+\.\d+"?)/.test(checks),
      true,
    );

    const releaseBinaries = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "release-binaries.yml"),
    );
    assertEquals(
      /version:\s*(latest|"?\d+\.\d+\.\d+"?)/.test(releaseBinaries),
      true,
    );
    assertEquals(releaseBinaries.includes("--include ./bin"), true);
    assertEquals(releaseBinaries.includes("deno task compile:lang"), true);
    assertEquals(releaseBinaries.includes("name: language-bin"), true);
    assertEquals(releaseBinaries.includes("pattern: uffda-*"), true);
  },
);
