import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./pipe.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test({
  name: "lang.pattern.pipe",
  ignore: p.state !== "granted",
  fn: async (t) => {
    await t.step({
      name: "PIPE_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Pipe",
        input: Input.Iterable(["any", "|", ">", "end"]),
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
      name: "PIPE_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Pipe",
        input: Input.Iterable([
          "any",
          "|",
          ">",
          "[",
          "end",
          "]",
          "|",
          ">",
          "ok",
        ]),
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
      name: "PIPE_LEADING_00 - a leading |> is allowed",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Pipe",
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
      name: "PIPE_LEADING_01 - a leading |> on a single step collapses to it",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Pipe",
        input: Input.Iterable(["|", ">", "any"]),
        kind: MatchKind.Ok,
        value: { kind: PatternKind.Any },
      }),
    });
  },
});

Deno.test({
  name: "lang.pattern.pipe comments",
  ignore: p.state !== "granted",
  fn: async (t) => {
    const comment = { kind: "comment", blocks: [] };
    await t.step({
      name: "PIPE_COMMENT_00 - a comment before |>",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Pipe",
        input: Input.Iterable(["any", comment, "|", ">", "fail"]),
        kind: MatchKind.Ok,
        value: {
          kind: PatternKind.Pipeline,
          steps: [{ kind: PatternKind.Any }, comment, {
            kind: PatternKind.Fail,
          }],
        },
      }),
    });
  },
});
