import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./pipe.ts", import.meta.url).href;

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
  },
});
