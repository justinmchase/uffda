import { assertEquals } from "@std/assert";
import { MatchKind, valueOf } from "../match.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { compileUffdaSource } from "./uffda/execute.ts";
import {
  type LanguageGrammar,
  LanguageRuleResolutionKind,
  resolveLanguageRule,
} from "./language_rule.ts";

const langUrl = new URL("file:///uffda/language_rule/lang.uff.ts");

const lang = (attributes: string) => `
export Words;
export Helper;
decorator Companion<r:object> = r;
decorator Value<v:any> = v;
${attributes}
rule Words = [string*];
rule Helper = ok -> 1;
`;

async function grammar(attributes: string): Promise<LanguageGrammar> {
  const compiled = await compileUffdaSource(lang(attributes));
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

Deno.test("lang.language_rule", async (t) => {
  await t.step(
    "LANGUAGE_RULE00 - the entry rule names a rule with the decorator",
    async () => {
      assertEquals(
        await resolveLanguageRule(
          await grammar("[Companion Helper]"),
          "Companion",
        ),
        {
          kind: LanguageRuleResolutionKind.Found,
          rule: {
            kind: "rule",
            name: "Helper",
            moduleUrl: langUrl.href,
            parameters: [],
          },
        },
      );
    },
  );

  await t.step(
    "LANGUAGE_RULE01 - a missing decorator, or one whose value is not a rule, names no rule",
    async () => {
      assertEquals(
        await resolveLanguageRule(await grammar(""), "Companion"),
        { kind: LanguageRuleResolutionKind.Missing },
      );
      assertEquals(
        await resolveLanguageRule(await grammar('[Value "x"]'), "Value"),
        { kind: LanguageRuleResolutionKind.Missing },
      );
    },
  );

  await t.step(
    "LANGUAGE_RULE02 - an unresolvable grammar is reported",
    async () => {
      const resolution = await resolveLanguageRule({
        moduleUrl: new URL("file:///uffda/language_rule/missing.uff.ts"),
        entryRuleName: "Words",
      }, "Companion");
      assertEquals(resolution.kind, LanguageRuleResolutionKind.Unresolved);
    },
  );
});
