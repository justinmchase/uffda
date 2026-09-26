import { assertEquals } from "@std/assert";
import { resolveGrammarModule } from "../grammar.ts";

/**
 * The `.uff` grammar's editor metadata (see `editor.uff` and
 * `.agents/specifications/languages/cli/editor-metadata.spec.md`): every
 * syntax fact editor tooling relies on is declared on these rules.
 */
const EXPECTED: Array<
  [
    module: string,
    entry: string,
    rule: string,
    decorator: string,
    value: unknown,
  ]
> = [
  ["../tokenizer/mod.uff", "Tokenizer", "WordToken", "Highlight", {
    role: "identifier",
  }],
  ["../tokenizer/mod.uff", "Tokenizer", "CommentToken", "Highlight", {
    role: "comment",
  }],
  ["../tokenizer/mod.uff", "Tokenizer", "WhitespaceToken", "Highlight", {
    role: "whitespace",
  }],
  ["../tokenizer/mod.uff", "Tokenizer", "NewLineToken", "Highlight", {
    role: "newline",
  }],
  ["../tokenizer/mod.uff", "Tokenizer", "PunctuationToken", "Highlight", {
    role: "punctuation",
  }],
  ["../tokenizer/mod.uff", "Tokenizer", "QuotedStringTokens", "Highlight", {
    role: "string",
  }],
  [
    "../uffda/import.rules.uff",
    "ImportDeclarationSyntax",
    "ImportDeclarationSyntax",
    "Import",
    true,
  ],
  [
    "../uffda/import.rules.uff",
    "ImportDeclarationSyntax",
    "ImportModulePath",
    "ModulePath",
    { extensions: [".uff"] },
  ],
  [
    "../uffda/import.rules.uff",
    "ImportDeclarationSyntax",
    "ImportNameEntry",
    "ImportedName",
    true,
  ],
  [
    "../uffda/rule.rules.uff",
    "RuleDeclarationSyntax",
    "RuleDeclarationSyntax",
    "Declaration",
    true,
  ],
  [
    "../uffda/func.rules.uff",
    "FuncDeclarationSyntax",
    "FuncDeclarationSyntax",
    "Declaration",
    true,
  ],
  [
    "../uffda/decorator.rules.uff",
    "DecoratorDeclarationSyntax",
    "DecoratorDeclarationSyntax",
    "Declaration",
    true,
  ],
  [
    "../uffda/attribute.rules.uff",
    "AttributeSyntax",
    "AttributeName",
    "NameReference",
    { kinds: ["decorator"] },
  ],
  [
    "../uffda/export.rules.uff",
    "ExportDeclarationSyntax",
    "ExportName",
    "NameReference",
    {},
  ],
  ["../pattern/resolve.uff", "ResolveName", "ResolveName", "NameReference", {
    kinds: ["rule"],
  }],
  ["../expression/reference.uff", "Reference", "Reference", "NameReference", {
    kinds: ["func"],
  }],
];

Deno.test("lang.editor metadata on the .uff grammar", async (t) => {
  for (const [module, entry, rule, decorator, value] of EXPECTED) {
    await t.step(`${rule} carries [${decorator}]`, async () => {
      const resolved = await resolveGrammarModule({
        moduleUrl: new URL(module, import.meta.url),
        entryRuleName: entry,
      });
      if (!resolved.ok) throw new Error(`cannot resolve ${module}`);
      const declared = resolved.resolved.module.rules.get(rule);
      assertEquals(declared?.metadata?.[decorator], value);
    });
  }
});
