import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { Type } from "@justinmchase/type";
import {
  CharacterClass,
  ResolveTargetKind,
} from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.ts", import.meta.url).href;

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
        input: Input.Scalar('foo<"bar">'),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "foo",
          args: [
            {
              kind: PatternKind.Equal,
              value: "bar",
            },
          ],
        },
      }),
    );

    await t.step(
      "escaped resolve identifiers allow keyword names",
      moduleDeclarationTest({
        moduleUrl,
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
      "variable projects a binding node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("variable x any"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Variable,
          name: "x",
          pattern: { kind: PatternKind.Any },
        },
      }),
    );

    await t.step(
      "quantifier preserves bounds",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("quantifier any (1, 3)"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: { kind: PatternKind.Any },
          min: 1,
          max: 3,
        },
      }),
    );

    await t.step(
      "membership and between project collection and range nodes",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("in[x y]"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Includes,
          values: ["x", "y"],
        },
      }),
    );

    await t.step(
      "between projects an ordered bound node",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("1..5"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: 1,
          right: 5,
        },
      }),
    );

    await t.step(
      "over projects keyed child patterns",
      moduleDeclarationTest({
        moduleUrl,
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
        input: Input.Scalar(
          '|\n  "literal"\n|\n  any\n  |>\n  [end]\n  |>\n  ok\n|\n  {\n    name: string,\n    aliases: [quantifier any (1,)],\n  }',
        ),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Equal,
              value: "literal",
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
                    min: 1,
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
