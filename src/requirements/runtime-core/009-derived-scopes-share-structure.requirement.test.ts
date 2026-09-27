import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { Scope } from "../../runtime/scope.ts";
import { InputNormalizationMode } from "../../input.ts";
import { type Match, MatchKind } from "../../match.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";
import type { Pattern } from "../../runtime/patterns/mod.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";

function scopesOf(root: Match): Scope[] {
  const scopes = new Set<Scope>();
  const seen = new Set<Match>();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    scopes.add(node.scope);
    if (node.kind === MatchKind.Ok || node.kind === MatchKind.Fail) {
      stack.push(...node.matches);
    }
  }
  return [...scopes];
}

Deno.test("req:runtime-core-009 - Derived scopes share their stack frames and options with the scope they derive from", async (t) => {
  await t.step(
    "pushing a frame shares the parent's frames",
    () => {
      const pipeline: Pattern = { kind: PatternKind.Ok };
      const parent = Scope.Default().pushPipeline(pipeline);
      const child = parent.pushPipeline(pipeline);
      assertEquals(child.depth, parent.depth + 1);
      assertStrictEquals(child.stack.parent, parent.stack);
      assertStrictEquals(child.stack.frames()[0], parent.stack.top);
    },
  );

  await t.step(
    "a derived scope with unchanged options shares the options object",
    () => {
      const scope = Scope.Default();
      assertStrictEquals(scope.addVariables({ x: 1 }).options, scope.options);
    },
  );

  await t.step(
    "every scope produced during a parse shares one options object and nested stacks share frames",
    async () => {
      const m = await executeUffdaSource(
        `export rule P = ("(" P ")") | "x";\n`,
        {
          input: "((x))",
          inputKind: InputNormalizationMode.Iterable,
          entryRuleName: "P",
        },
      );
      assertEquals(m.kind, MatchKind.Ok);
      const scopes = scopesOf(m);
      assertEquals(new Set(scopes.map((s) => s.options)).size, 1);
      const frames = new Set<unknown>();
      let totalDepth = 0;
      for (const scope of scopes) {
        totalDepth += scope.depth;
        for (let s = scope.stack; s.parent; s = s.parent) frames.add(s);
      }
      assert(totalDepth > 0);
      assert(frames.size < totalDepth);
    },
  );
});
