import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./reference.ts", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

Deno.test(
  {
    name: "lang.expression.reference",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "REFERENCE_EXPRESSION_00",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["x"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Reference, name: "x" },
      }),
    });
    await t.step({
      name: "REFERENCE_EXPRESSION_01",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["_abc123"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Reference, name: "_abc123" },
      }),
    });
    await t.step({
      name: "REFERENCE_EXPRESSION_02",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["abc_123_xyz"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Reference, name: "abc_123_xyz" },
      }),
    });
    await t.step({
      name: "REFERENCE_EXPRESSION_03",
      fn: moduleDeclarationTest({
        moduleUrl,
        input: Input.From(["1abc"]),
        kind: MatchKind.Fail,
      }),
    });
  },
);
