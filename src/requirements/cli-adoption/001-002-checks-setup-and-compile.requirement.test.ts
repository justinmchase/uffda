import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:cli-adoption-001 - checks workflow uses uffda-setup with a published CLI",
  async () => {
    const yaml = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );
    assertEquals(yaml.includes("uses: ./.github/actions/uffda-setup"), true);
    // Prefer latest; allow a pinned published SemVer when latest cannot compile
    // the current tree (bootstrap chicken-egg after a bad release).
    assertEquals(
      /version:\s*(latest|"?\d+\.\d+\.\d+"?)/.test(yaml),
      true,
    );
  },
);

Deno.test(
  "req:cli-adoption-002 - checks compile language .uff modules into ./bin",
  async () => {
    const yaml = await Deno.readTextFile(
      join(repoRoot, ".github", "workflows", "checks.yml"),
    );
    assertEquals(yaml.includes("uffda compile 'src/lang/**/*.uff'"), true);
    assertEquals(yaml.includes("deno task compile:lang"), false);
    assertEquals(yaml.includes("finalize-bin-modules"), false);
    assertEquals(yaml.includes("deno test"), false);
    assertEquals(yaml.includes("deno lint"), false);
    assertEquals(yaml.includes("deno fmt"), false);
  },
);
