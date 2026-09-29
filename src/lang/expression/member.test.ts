import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./member.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

const ref = (name: string) => ({ kind: ExpressionKind.Reference, name });

Deno.test(
  {
    name: "lang.expression.member",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "MEMBER_00 - a single member access",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Member",
        input: Input.Iterable(["a", ".", "b"]),
        kind: MatchKind.Ok,
        value: { kind: ExpressionKind.Member, expression: ref("a"), name: "b" },
      }),
    });

    await t.step({
      name: "MEMBER_01 - chains fold to the left",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Member",
        input: Input.Iterable(["a", ".", "b", ".", "c"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Member,
          expression: {
            kind: ExpressionKind.Member,
            expression: ref("a"),
            name: "b",
          },
          name: "c",
        },
      }),
    });

    await t.step({
      name: "MEMBER_02 - an invocation base",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Member",
        input: Input.Iterable(["(", "f", " ", "x", ")", ".", "y"]),
        kind: MatchKind.Ok,
        value: {
          kind: ExpressionKind.Member,
          expression: {
            kind: ExpressionKind.Invocation,
            expression: ref("f"),
            args: [ref("x")],
          },
          name: "y",
        },
      }),
    });

    await t.step({
      name: "MEMBER_03 - a bare base is not a member",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Member",
        input: Input.Iterable(["a"]),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "MEMBER_04 - a trailing dot is not a member",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "Member",
        input: Input.Iterable(["a", "."]),
        kind: MatchKind.Fail,
      }),
    });
  },
);
