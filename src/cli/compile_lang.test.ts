import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../", import.meta.url));

Deno.test("cli.compile_lang documents previous-CLI bootstrap pipeline", async () => {
  const source = await Deno.readTextFile(
    join(repoRoot, "src", "cli", "compile_lang.ts"),
  );
  assertEquals(source.includes('new Deno.Command("uffda"'), true);
  assertEquals(source.includes("lowerUffdaSyntaxModule"), true);
  assertEquals(source.includes("ModuleDeclaration"), true);
});
