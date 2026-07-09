import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import {
  CharacterClass,
  ResolveTargetKind,
} from "../../runtime/patterns/pattern.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { Type } from "@justinmchase/type";
import { assertEquals } from "@std/assert";
import { patternGrammar } from "./pattern.lang.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./pattern.lang.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.pattern.pattern-lang",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "PATTERN_GRAMMAR_FN_00",
      fn: async () => {
        const m = await patternGrammar("any");
        assertEquals(m.kind, MatchKind.Ok);
        if (m.kind === MatchKind.Ok) {
          assertEquals(m.value, { kind: PatternKind.Any });
        }
      },
    });

    await t.step({
      name: "PATTERN_LANG_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any"),
        kind: MatchKind.Ok,
        value: { kind: PatternKind.Any },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("not any"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Any },
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any | fail"),
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
      name: "PATTERN_LANG_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any & fail | ok"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.And,
              patterns: [
                { kind: PatternKind.Any },
                { kind: PatternKind.Fail },
              ],
            },
            { kind: PatternKind.Ok },
          ],
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_04",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("| any | fail | ok"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
            { kind: PatternKind.Ok },
          ],
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_05",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any and fail"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "PATTERN_LANG_06",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any or fail"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "PATTERN_LANG_10",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("string"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Type,
          type: Type.String,
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_11",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("\\cL"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Character,
          characterClass: CharacterClass.Letter,
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_12",
      fn: moduleDeclarationTest({
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
    });

    await t.step({
      name: "PATTERN_LANG_13",
      fn: moduleDeclarationTest({
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
    });

    await t.step({
      name: "PATTERN_LANG_13A",
      fn: moduleDeclarationTest({
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
    });

    await t.step({
      name: "PATTERN_LANG_13B",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar('foo<bar<"baz">>'),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "foo",
          args: [
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "bar",
              args: [
                {
                  kind: PatternKind.Equal,
                  value: "baz",
                },
              ],
            },
          ],
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_14",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("in[x y]"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Includes,
          values: ["x", "y"],
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_14A",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("1..5"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Between,
          left: 1,
          right: 5,
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_14B",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar('"hello"'),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: "hello",
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_15",
      fn: moduleDeclarationTest({
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
    });

    await t.step({
      name: "PATTERN_LANG_16",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("{name: any, enabled: end, }"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            name: { kind: PatternKind.Any },
            enabled: { kind: PatternKind.End },
          },
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_17",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar('includes [1 "x"]'),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "PATTERN_LANG_18",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar('"{foo}"'),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Equal,
          value: "{foo}",
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_19",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("not\nany"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Any },
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_20",
      fn: moduleDeclarationTest({
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
    });

    await t.step({
      name: "PATTERN_LANG_21",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("|\nany\n|\nfail\n|\nok"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Or,
          patterns: [
            { kind: PatternKind.Any },
            { kind: PatternKind.Fail },
            { kind: PatternKind.Ok },
          ],
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_22",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("{\nname: any,\nenabled: end,\n}"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Over,
          keys: {
            name: { kind: PatternKind.Any },
            enabled: { kind: PatternKind.End },
          },
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_23",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any |> [end] |> ok"),
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
    });

    await t.step({
      name: "PATTERN_LANG_24",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("over {name: any}"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "PATTERN_LANG_25",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("pipeline { any; end; }"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "PATTERN_LANG_26",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("into end"),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "PATTERN_LANG_27",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("any |> (end | fail)"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Any },
            {
              kind: PatternKind.Or,
              patterns: [
                { kind: PatternKind.End },
                { kind: PatternKind.Fail },
              ],
            },
          ],
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_28",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.Scalar("(any |> [end])"),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Any },
            {
              kind: PatternKind.Into,
              pattern: { kind: PatternKind.End },
            },
          ],
        },
      }),
    });

    await t.step({
      name: "PATTERN_LANG_29",
      fn: moduleDeclarationTest({
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
    });
  },
);
