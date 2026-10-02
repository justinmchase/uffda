import { assert, assertEquals } from "@std/assert";
import { MatchKind, valueOf } from "../match.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { compileUffdaSource } from "./uffda/execute.ts";
import {
  FormatResultKind,
  formatSource,
  FormatterResolutionKind,
  formatTree,
  type LanguageGrammar,
  resolveFormatter,
} from "./format.ts";

const langUrl = new URL("file:///uffda/format/lang.uff.ts");
const printUrl = new URL("file:///uffda/format/print.uff.ts");

const print = `
export Print;
export Count;
rule Print = [w:string*] -> (join w " ");
rule Count = ok -> 1;
`;

const lang = (formatter: string) => `
import "./print.uff.ts" Print Count;
export Words;
decorator Formatter<f:object> = f;
decorator Other<f:any> = f;
${formatter}
rule Words = [w:Item* end] -> w;
rule Item = w:Word Space* -> w;
rule Word = w:("a".."z"+) -> (join w "");
rule Space = " ";
`;

async function compile(source: string): Promise<ModuleDeclaration> {
  const compiled = await compileUffdaSource(source);
  if (compiled.kind !== MatchKind.Ok) {
    throw new Error(`compile failed: ${compiled.kind}`);
  }
  return valueOf(compiled) as ModuleDeclaration;
}

async function grammar(formatter: string): Promise<LanguageGrammar> {
  return {
    moduleUrl: langUrl,
    entryRuleName: "Words",
    declarations: {
      [langUrl.href]: await compile(lang(formatter)),
      [printUrl.href]: await compile(print),
    },
  };
}

Deno.test("lang.format", async (t) => {
  await t.step(
    "FORMAT_CORE00 - the entry rule names its formatter",
    async () => {
      const resolution = await resolveFormatter(
        await grammar("[Formatter Print]"),
      );
      assertEquals(resolution, {
        kind: FormatterResolutionKind.Found,
        formatter: {
          kind: "rule",
          name: "Print",
          moduleUrl: printUrl.href,
          parameters: [],
        },
      });
    },
  );

  await t.step(
    "FORMAT_CORE01 - an entry rule without [Formatter] has no formatter",
    async () => {
      assertEquals(
        await resolveFormatter(await grammar("[Other Print]")),
        { kind: FormatterResolutionKind.NoFormatter },
      );
      assertEquals(
        await formatSource(await grammar(""), "a b"),
        { kind: FormatResultKind.NoFormatter },
      );
    },
  );

  await t.step(
    "FORMAT_CORE02 - an unresolvable grammar is reported",
    async () => {
      const resolution = await resolveFormatter({
        moduleUrl: new URL("file:///uffda/format/missing.uff.ts"),
        entryRuleName: "Words",
      });
      assertEquals(resolution.kind, FormatterResolutionKind.Unresolved);
    },
  );

  await t.step(
    "FORMAT_CORE03 - source is parsed and its parse value formatted",
    async () => {
      assertEquals(
        await formatSource(await grammar("[Formatter Print]"), "a   bc  d"),
        { kind: FormatResultKind.Formatted, text: "a bc d" },
      );
    },
  );

  await t.step(
    "FORMAT_CORE04 - source that does not parse cleanly is not formatted",
    async () => {
      const result = await formatSource(
        await grammar("[Formatter Print]"),
        "a 1 b",
      );
      assertEquals(result.kind, FormatResultKind.ParseFailed);
    },
  );

  await t.step(
    "FORMAT_CORE05 - a formatter that produces no text fails",
    async () => {
      const result = await formatSource(
        await grammar("[Formatter Count]"),
        "a b",
      );
      assert(result.kind === FormatResultKind.FormatFailed);
      assertEquals(result.message, "formatter Count did not produce text");
    },
  );

  await t.step(
    "FORMAT_CORE06 - a formatter that does not match the tree fails",
    async () => {
      const { declarations } = await grammar("");
      const result = await formatTree(
        {
          kind: "rule",
          name: "Print",
          moduleUrl: printUrl.href,
          parameters: [],
        },
        [1, 2],
        declarations,
      );
      assert(result.kind === FormatResultKind.FormatFailed);
      assertEquals(
        result.message,
        "formatter Print did not match the parse tree",
      );
    },
  );
});
