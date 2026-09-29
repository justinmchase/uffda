import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  ResolveTargetKind,
  ValueSourceKind,
} from "../../runtime/patterns/pattern.ts";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

const semi = {
  kind: PatternKind.Equal,
  value: { kind: ValueSourceKind.Literal, value: ";" },
};

const reference = (name: string) => ({
  kind: PatternKind.Resolve,
  targetKind: ResolveTargetKind.Reference,
  name,
  args: [],
});

Deno.test({
  name: "req:pattern-language-syntax-010 - Ope syntax",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step(
      "ope P sneak by S normalizes to a recover pattern",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("ope Stmt sneak by any"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Recover,
          pattern: reference("Stmt"),
          skip: { kind: PatternKind.Any },
        },
      }),
    );

    await t.step(
      "operands bind as prefix operands",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("ope s:Stmt sneak by any+"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Recover,
          pattern: {
            kind: PatternKind.Variable,
            name: "s",
            pattern: reference("Stmt"),
          },
          skip: {
            kind: PatternKind.Quantifier,
            pattern: { kind: PatternKind.Any },
            min: { kind: ValueSourceKind.Literal, value: 1 },
            max: undefined,
          },
        },
      }),
    );

    await t.step(
      "sneak by until T skips one or more items not starting T",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar(`ope Stmt sneak by until ";"`),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Recover,
          pattern: reference("Stmt"),
          skip: {
            kind: PatternKind.Quantifier,
            pattern: {
              kind: PatternKind.Then,
              patterns: [
                { kind: PatternKind.Not, pattern: semi },
                { kind: PatternKind.Any },
              ],
            },
            min: { kind: ValueSourceKind.Literal, value: 1 },
            max: undefined,
          },
        },
      }),
    );

    for (const name of ["ope", "sneak", "until"]) {
      await t.step(
        `${name} is reserved`,
        moduleDeclarationTest({
          moduleUrl,
          entryRuleName: "PatternLang",
          input: Input.Scalar(name),
          kind: MatchKind.Fail,
        }),
      );

      await t.step(
        `@${name} references a rule named ${name}`,
        moduleDeclarationTest({
          moduleUrl,
          entryRuleName: "PatternLang",
          input: Input.Scalar(`@${name}`),
          kind: MatchKind.Ok,
          value: reference(name),
        }),
      );
    }

    await t.step(
      "by is not reserved",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("by"),
        kind: MatchKind.Ok,
        value: reference("by"),
      }),
    );
  },
});
