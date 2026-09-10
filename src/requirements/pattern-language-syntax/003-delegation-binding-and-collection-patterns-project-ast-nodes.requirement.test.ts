import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { Type } from "@justinmchase/type";
import {
  CharacterClass,
  ResolveTargetKind,
  ValueSourceKind,
} from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name:
      "req:pattern-language-syntax-003 - Delegation, binding, and collection forms project AST nodes",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step(
      "resolve projects a reference target",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("foo"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "foo",
          args: [],
        },
      }),
    );

    await t.step(
      "resolve arguments project nested pattern nodes",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar('foo<"bar">'),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "foo",
          args: [
            {
              kind: PatternKind.Equal,
              value: { kind: ValueSourceKind.Literal, value: "bar" },
            },
          ],
        },
      }),
    );

    await t.step(
      "escaped resolve identifiers allow keyword names",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("@any"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "any",
          args: [],
        },
      }),
    );

    await t.step(
      "capture projects a variable binding node",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("x:any"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: { kind: PatternKind.Any },
        },
      }),
    );

    await t.step(
      "postfix repetition preserves bounds",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("any*1..3"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: { kind: ValueSourceKind.Literal, value: 1 },
          max: { kind: ValueSourceKind.Literal, value: 3 },
        },
      }),
    );

    await t.step(
      "membership and between project collection and range nodes",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("in[x y]"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Includes,
          values: [{ kind: ValueSourceKind.Literal, value: "x" }, {
            kind: ValueSourceKind.Literal,
            value: "y",
          }],
        },
      }),
    );

    await t.step(
      "between projects an ordered bound node",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("1..5"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: { kind: ValueSourceKind.Literal, value: 1 },
          right: { kind: ValueSourceKind.Literal, value: 5 },
        },
      }),
    );

    await t.step(
      "over projects keyed child patterns",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("{name: any, enabled: \\cL, }"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            name: { kind: PatternKind.Any },
            enabled: {
              kind: PatternKind.Character,
              characterClass: CharacterClass.Letter,
            },
          },
        },
      }),
    );

    await t.step(
      "pipeline projects ordered steps",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("any |> end"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Any },
            { kind: PatternKind.End },
          ],
        },
      }),
    );

    await t.step(
      "canonical multiline authoring composes alternatives pipelines and keyed forms",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar(
          '|\n  "literal"\n|\n  any\n  |>\n  [end]\n  |>\n  ok\n|\n  {\n    name: string,\n    aliases: [any+],\n  }',
        ),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Equal,
              value: { kind: ValueSourceKind.Literal, value: "literal" },
            },
            {
              kind: PatternKind.Pipeline,
              steps: [
                { kind: PatternKind.Any },
                {
                  kind: PatternKind.Into,
                  pattern: { kind: PatternKind.End },
                },
                { kind: PatternKind.Ok },
              ],
            },
            {
              kind: PatternKind.Over,
              keys: {
                name: {
                  kind: PatternKind.Type,
                  type: Type.String,
                },
                aliases: {
                  kind: PatternKind.Into,
                  pattern: {
                    kind: PatternKind.Quantifier,
                    pattern: { kind: PatternKind.Any },
                    min: { kind: ValueSourceKind.Literal, value: 1 },
                    max: undefined,
                  },
                },
              },
            },
          ],
        },
      }),
    );
  },
);
