import { Input } from "../../input.ts";
import { MatchKind } from "../../mod.ts";
import { moduleDeclarationTest } from "../../test.ts";

const moduleUrl = new URL("./comment.uff", import.meta.url).href;

const p = await Deno.permissions.query({
  name: "read",
  path: moduleUrl,
});

const comment = { kind: "comment", blocks: [] };

Deno.test(
  {
    name: "lang.common.comment",
    ignore: p.state !== "granted",
  },
  async (t) => {
    await t.step({
      name: "COMMENT_NODE_00 - a comment node matches",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "CommentNode",
        input: Input.Iterable([comment]),
        kind: MatchKind.Ok,
        value: comment,
      }),
    });

    await t.step({
      name: "COMMENT_NODE_01 - a raw comment token does not match",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "CommentNode",
        input: Input.Iterable([{ kind: "comment", text: "# x" }]),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "COMMENT_NODE_02 - a text does not match",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "CommentNode",
        input: Input.Iterable(["#"]),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "COMMENT_NODE_03 - a comment after code on the same line fails",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "CommentNode",
        input: Input.Iterable([{ kind: "lineEndComment", comment }]),
        kind: MatchKind.Fail,
      }),
    });

    await t.step({
      name: "OWN_LINE_COMMENT_00 - matches only a comment on its own line",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "OwnLineComment",
        input: Input.Iterable([comment]),
        kind: MatchKind.Ok,
        value: comment,
      }),
    });

    await t.step({
      name: "OWN_LINE_COMMENT_01 - a comment after code does not match",
      fn: moduleDeclarationTest({
        moduleUrl,
        entryRuleName: "OwnLineComment",
        input: Input.Iterable([{ kind: "lineEndComment", comment }]),
        kind: MatchKind.Fail,
      }),
    });
  },
);
