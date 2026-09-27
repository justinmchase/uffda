import { assert, assertEquals } from "@std/assert";
import { documentationOf } from "../../cli/editor_metadata.ts";
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
  [
    "../pattern/character_class.uff",
    "CharacterClass",
    "CharacterClass",
    "Highlight",
    { role: "string" },
  ],
  ...([
    ["../uffda/shared.rules.uff", "IdentifierToken", "RuleKeyword"],
    ["../pattern/switch.uff", "Switch", "SwitchKeyword"],
    ["../pattern/switch.uff", "Switch", "DefaultKeyword"],
    ["../pattern/prefix.uff", "Prefix", "NotKeyword"],
    ["../pattern/prefix.uff", "Prefix", "MaybeKeyword"],
    ["../pattern/prefix.uff", "Prefix", "LookaheadKeyword"],
    ["../pattern/prefix.uff", "Prefix", "ExceptKeyword"],
    ["../pattern/literals.uff", "Literals", "InKeyword"],
    ["../pattern/literals.uff", "Literals", "TypeString"],
    ["../pattern/atoms.uff", "Atoms", "Any"],
    ["../pattern/atoms.uff", "Atoms", "Fail"],
    ["../expression/not.uff", "Not", "NotKeyword"],
    ["../expression/boolean.uff", "Boolean", "TrueKeyword"],
    ["../expression/nullish.uff", "Nullish", "NullKeyword"],
  ] as const).map(([module, entry, rule]) =>
    [module, entry, rule, "Keyword", { role: "keyword" }] as [
      string,
      string,
      string,
      string,
      unknown,
    ]
  ),
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

Deno.test("lang.editor decorators document themselves", async (t) => {
  const resolved = await resolveGrammarModule({
    moduleUrl: new URL("./editor.uff", import.meta.url),
    entryRuleName: "Documentation",
  });
  if (!resolved.ok) throw new Error("cannot resolve editor.uff");
  const { decorators } = resolved.resolved.module;
  const parametersOf: Record<string, string[]> = {
    Highlight: ["c"],
    Keyword: [],
    Declaration: [],
    NameReference: ["c"],
    Import: [],
    ModulePath: ["c"],
    ImportedName: [],
    Documentation: ["d"],
  };
  for (const [name, parameters] of Object.entries(parametersOf)) {
    await t.step(`${name} carries [Documentation]`, () => {
      const documentation = documentationOf(
        decorators.get(name)?.metadata ?? {},
      );
      assert(documentation?.description, `${name} has a description`);
      assertEquals(
        Object.keys(documentation.parameters).sort(),
        parameters,
      );
    });
  }
});
