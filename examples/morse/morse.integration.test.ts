import { assertEquals } from "@std/assert";
import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { Input } from "../../src/input.ts";
import { compileUffdaSyntaxModule } from "../../src/lang/uffda/uffda.lang.ts";
import { MatchKind } from "../../src/match.ts";
import { executeModuleDeclaration } from "../../src/runtime/module.execute.ts";
import { compileSourcesToAstArtifacts } from "../../src/cli/compile.ts";

const writePermission = await Deno.permissions.query({
  name: "write",
});

const thisFile = fromFileUrl(import.meta.url);
const projectRoot = resolve(dirname(thisFile), "../..");

const MOBY_DICK_EXCERPT = `I quickly followed suit, and descending into the
bar-room accosted the grinning landlord very pleasantly. I cherished no malice
towards him, though he had been skylarking with me not a little in the matter of
my bedfellow.

However, a good laugh is a mighty good thing, and rather too scarce a good
thing; the more's the pity. So, if any one man, in his own proper person, afford
stuff for a good joke to anybody, let him not be backward, but let him
cheerfully allow himself to spend and be spent in that way. And the man that has
anything bountifully laughable about him, be sure there is more in that man than
you perhaps think for.`;

function normalizeWrappedText(text: string): string {
  return text
    .split("\n\n")
    .map((paragraph) => paragraph.replaceAll("\n", " "))
    .join("\n\n");
}

function normalizeMorseInput(text: string): string {
  return normalizeWrappedText(text).toUpperCase();
}

Deno.test({
  name:
    "cli.integration compiles morse.uff to JSON and roundtrips moby dick text",
  ignore: writePermission.state !== "granted",
  fn: async () => {
    const morseSourcePath = join(projectRoot, "examples", "morse", "morse.uff");
    const tempRoot = await Deno.makeTempDir({
      prefix: "uffda-morse-integration-",
    });
    const outputDir = join(tempRoot, "ast");

    const compiled = await compileSourcesToAstArtifacts({
      cwd: projectRoot,
      sourcePaths: [morseSourcePath],
      outputDir,
    });

    assertEquals(compiled.ok, true);
    assertEquals(compiled.failures.length, 0);
    assertEquals(compiled.successes.length, 1);

    const artifactText = await Deno.readTextFile(
      compiled.successes[0].outputPath,
    );
    const ast = JSON.parse(artifactText) as Parameters<
      typeof compileUffdaSyntaxModule
    >[0];
    assertEquals(ast.kind, "module");

    const declaration = await compileUffdaSyntaxModule(ast);
    const sourceText = normalizeMorseInput(MOBY_DICK_EXCERPT);

    const encoded = await executeModuleDeclaration(declaration, {
      entryRuleName: "Text",
      input: Input.Iterable(sourceText),
    });
    assertEquals(encoded.kind, MatchKind.Ok);
    if (encoded.kind !== MatchKind.Ok) return;
    assertEquals(typeof encoded.value, "string");
    if (typeof encoded.value !== "string") return;

    const decoded = await executeModuleDeclaration(declaration, {
      entryRuleName: "Morse",
      input: Input.Iterable(encoded.value),
    });
    assertEquals(decoded.kind, MatchKind.Ok);
    if (decoded.kind !== MatchKind.Ok) return;
    assertEquals(decoded.value, sourceText);
  },
});
