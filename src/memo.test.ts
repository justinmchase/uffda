import { assertEquals } from "@std/assert";
import { Memos } from "./memo.ts";
import { Path } from "./path.ts";
import type { Match } from "./match.ts";
import type { Rule } from "./runtime/modules/rule.ts";

function fakeMatch(): Match {
  return {} as Match;
}

function fakeRule(name: string): Rule {
  return { name } as Rule;
}

Deno.test("memo recovery", async (t) => {
  await t.step({
    name: "MEMO_LAYER - a layer shares recoverable but no entries",
    fn: () => {
      const memos = new Memos();
      const rule = fakeRule("a");
      const path = Path.From(0);
      memos.set(path, memos.resolve(path, rule, []).key, fakeMatch());

      const layer = memos.layer();
      assertEquals(layer.resolve(path, rule, []).memo, undefined);
      assertEquals(layer.size, 0);

      layer.recoverable = true;
      assertEquals(memos.recoverable, true);
      memos.recoverable = false;
      assertEquals(layer.recoverable, false);
    },
  });
});
