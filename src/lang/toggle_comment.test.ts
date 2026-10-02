import { assert, assertEquals } from "@std/assert";
import { MatchKind, valueOf } from "../match.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { compileUffdaSource } from "./uffda/execute.ts";
import type { LanguageGrammar } from "./language_rule.ts";
import { UFFDA_GRAMMAR } from "./uffda/uffda.lang.ts";
import { toggleComment, ToggleCommentResultKind } from "./toggle_comment.ts";

const langUrl = new URL("file:///uffda/toggle_comment/lang.uff.ts");

const lang = (toggle: string) => `
export Words;
export Wrap;
export Count;
export Never;
decorator ToggleComment<t:object> = t;
${toggle}
rule Words = [string*];
rule Wrap = s:string -> (join ["<" s ">"] "");
rule Count = ok -> 1;
rule Never = fail;
`;

async function grammar(toggle: string): Promise<LanguageGrammar> {
  const compiled = await compileUffdaSource(lang(toggle));
  if (compiled.kind !== MatchKind.Ok) {
    throw new Error(`compile failed: ${compiled.kind}`);
  }
  return {
    moduleUrl: langUrl,
    entryRuleName: "Words",
    declarations: {
      [langUrl.href]: valueOf(compiled) as ModuleDeclaration,
    },
  };
}

Deno.test("lang.toggle_comment", async (t) => {
  await t.step(
    "TOGGLE_CORE00 - the lines are toggled by the rule the entry rule names",
    async () => {
      assertEquals(
        await toggleComment(await grammar("[ToggleComment Wrap]"), "a\nb"),
        { kind: ToggleCommentResultKind.Toggled, text: "<a\nb>" },
      );
    },
  );

  await t.step(
    "TOGGLE_CORE01 - an entry rule without [ToggleComment] cannot toggle",
    async () => {
      assertEquals(
        await toggleComment(await grammar(""), "a"),
        { kind: ToggleCommentResultKind.NoToggleComment },
      );
    },
  );

  await t.step(
    "TOGGLE_CORE02 - an unresolvable grammar is reported",
    async () => {
      const result = await toggleComment({
        moduleUrl: new URL("file:///uffda/toggle_comment/missing.uff.ts"),
        entryRuleName: "Words",
      }, "a");
      assertEquals(result.kind, ToggleCommentResultKind.Unresolved);
    },
  );

  await t.step(
    "TOGGLE_CORE03 - a toggle that fails or produces no text fails",
    async () => {
      const never = await toggleComment(
        await grammar("[ToggleComment Never]"),
        "a",
      );
      assert(never.kind === ToggleCommentResultKind.ToggleFailed);
      assertEquals(
        never.message,
        "comment toggle Never did not match the lines",
      );
      const count = await toggleComment(
        await grammar("[ToggleComment Count]"),
        "a",
      );
      assert(count.kind === ToggleCommentResultKind.ToggleFailed);
      assertEquals(count.message, "comment toggle Count did not produce text");
    },
  );

  await t.step(
    "TOGGLE_CORE04 - the .uff language toggles # comments",
    async () => {
      assertEquals(
        await toggleComment(UFFDA_GRAMMAR, "rule A = a;"),
        { kind: ToggleCommentResultKind.Toggled, text: "# rule A = a;" },
      );
    },
  );
});
