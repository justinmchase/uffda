import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./or.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.or",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "OR_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Or",
        input: Input.Iterable(["any", "|", "fail"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    });

    await t.step({
      name: "OR_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Or",
        input: Input.Iterable(["|", "any", "|", "fail"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    });

    await t.step({
      name: "OR_LEADING_PIPE - a leading |> is a pipeline, not a leading |",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Or",
        input: Input.Iterable(["|", ">", "any", "|", ">", "end"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Any },
            { kind: PatternKind.End },
          ],
        },
      }),
    });

    await t.step({
      name: "OR_LEADING_PIPE_BRANCH - a leading | before a leading |> branch",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Or",
        input: Input.Iterable([
          "|",
          "|",
          ">",
          "any",
          "|",
          ">",
          "end",
          "|",
          "fail",
        ]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Pipeline,
              steps: [
                { kind: PatternKind.Any },
                { kind: PatternKind.End },
              ],
            },
            { kind: PatternKind.Fail },
          ],
        },
      }),
    });
  },
});
