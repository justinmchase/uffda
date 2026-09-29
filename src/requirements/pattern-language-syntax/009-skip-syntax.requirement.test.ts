import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { moduleDeclarationTest } from "../../test.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  ResolveTargetKind,
  ValueSourceKind,
} from "../../runtime/patterns/pattern.ts";
import { Type } from "@justinmchase/type";

const moduleUrl =
  new URL("../../lang/pattern/pattern.lang.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

const comma = {
  kind: PatternKind.Equal,
  value: { kind: ValueSourceKind.Literal, value: "," },
};

Deno.test({
  name: "req:pattern-language-syntax-009 - Skip syntax",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step(
      "skip P normalizes to a skip pattern",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar(`skip ","`),
        kind: MatchKind.Ok,
        value: { kind: PatternKind.Skip, pattern: comma },
      }),
    );

    await t.step(
      "bare skip normalizes to skip over any",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("skip"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Any },
        },
      }),
    );

    await t.step(
      "skip applies to the whole postfix operand",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar(`skip ","*`),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Skip,
          pattern: {
            kind: PatternKind.Quantifier,
            pattern: comma,
            min: undefined,
            max: undefined,
          },
        },
      }),
    );

    await t.step(
      "skip v:P skips the capture",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar(`skip v:","`),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Variable, name: "v", pattern: comma },
        },
      }),
    );

    await t.step(
      "(string | skip)* is a quantifier over an or with a bare skip",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("(string | skip)*"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Quantifier,
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              { kind: PatternKind.Type, type: Type.String },
              { kind: PatternKind.Skip, pattern: { kind: PatternKind.Any } },
            ],
          },
          min: undefined,
          max: undefined,
        },
      }),
    );

    await t.step(
      "@skip references a rule named skip",
      moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "PatternLang",
        input: Input.Scalar("@skip"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "skip",
          args: [],
        },
      }),
    );
  },
});
