import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
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
      "req:pattern-language-syntax-004 - Line breaks are non-semantic between tokens",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step(
      "line breaks behave like spaces between prefix tokens",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("not\nany"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Any },
        },
      }),
    );

    await t.step(
      "line breaks behave like spaces around resolve arguments",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar('foo\n<\n"bar"\n>'),
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
      "line breaks preserve multiline alternatives and object-like forms",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar(
          "{\nname: |\n  any\n  | fail,\nenabled: end,\n}",
        ),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            name: {
              kind: PatternKind.Or,
              patterns: [
                { kind: PatternKind.Any },
                { kind: PatternKind.Fail },
              ],
            },
            enabled: { kind: PatternKind.End },
          },
        },
      }),
    );

    await t.step(
      "line breaks behave like spaces around pipeline operators",
      moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any\n|>\n[\nend\n]\n|>\nok"),
        kind: MatchKind.Ok,
        value: {
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
      }),
    );
  },
);
