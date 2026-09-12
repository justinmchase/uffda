import { assertEquals } from "@std/assert";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import type { Pattern } from "./patterns/pattern.ts";
import { CharacterClass } from "./patterns/pattern.ts";
import { DefaultModule } from "./modules/module.ts";
import type { Module } from "./modules/module.ts";
import type { Rule } from "./modules/rule.ts";
import { SpecialKind } from "./modules/special.ts";
import { canSkipMemo } from "./rule.reentrancy.ts";

function makeRule(
  module: Module,
  name: string,
  pattern: Pattern,
  parameters: { name: string }[] = [],
): Rule {
  const rule: Rule = { name, module, pattern, parameters };
  module.rules.set(name, rule);
  return rule;
}

function resolveRef(name: string, args: Pattern[] = []): Pattern {
  return {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Reference,
    name,
    args,
  };
}

const character: Pattern = {
  kind: PatternKind.Character,
  characterClass: CharacterClass.Letter,
};

Deno.test("rule.reentrancy", async (t) => {
  await t.step(
    "REENTRANCY00 - a leaf rule with no calls is safe to skip memo for",
    () => {
      const module = DefaultModule();
      const leaf = makeRule(module, "leaf", character);
      assertEquals(canSkipMemo(leaf), true);
    },
  );

  await t.step(
    "REENTRANCY01 - a rule that only calls a non-cyclic rule is safe too",
    () => {
      const module = DefaultModule();
      const leaf = makeRule(module, "leaf", character);
      const wrapper = makeRule(module, "wrapper", resolveRef("leaf"));
      assertEquals(canSkipMemo(leaf), true);
      assertEquals(canSkipMemo(wrapper), true);
    },
  );

  await t.step(
    "REENTRANCY02 - a directly self-recursive rule must stay memoized",
    () => {
      const module = DefaultModule();
      const group = makeRule(module, "group", {
        kind: PatternKind.Or,
        patterns: [resolveRef("leaf"), resolveRef("group")],
      });
      makeRule(module, "leaf", character);
      assertEquals(canSkipMemo(group), false);
    },
  );

  await t.step(
    "REENTRANCY03 - mutually recursive rules must both stay memoized",
    () => {
      const module = DefaultModule();
      makeRule(module, "a", resolveRef("b"));
      makeRule(module, "b", resolveRef("a"));
      assertEquals(canSkipMemo(module.rules.get("a")!), false);
      assertEquals(canSkipMemo(module.rules.get("b")!), false);
    },
  );

  await t.step(
    "REENTRANCY04 - a rule reached only via a cycle elsewhere is unaffected",
    () => {
      // a -> b -> c -> b (b/c cycle does not involve a)
      const module = DefaultModule();
      makeRule(module, "a", resolveRef("b"));
      makeRule(module, "b", resolveRef("c"));
      makeRule(module, "c", resolveRef("b"));
      assertEquals(canSkipMemo(module.rules.get("a")!), true);
      assertEquals(canSkipMemo(module.rules.get("b")!), false);
      assertEquals(canSkipMemo(module.rules.get("c")!), false);
    },
  );

  await t.step(
    "REENTRANCY05 - a parameterized rule is conservatively never skipped",
    () => {
      const module = DefaultModule();
      const generic = makeRule(module, "generic", character, [{
        name: "x",
      }]);
      assertEquals(canSkipMemo(generic), false);
    },
  );

  await t.step(
    "REENTRANCY06 - a call passing rule-valued arguments is dynamic",
    () => {
      const module = DefaultModule();
      makeRule(module, "leaf", character);
      const caller = makeRule(
        module,
        "caller",
        resolveRef("leaf", [character]),
      );
      assertEquals(canSkipMemo(caller), false);
    },
  );

  await t.step(
    "REENTRANCY07 - resolve.run is dynamic (target not statically pinned)",
    () => {
      const module = DefaultModule();
      const caller = makeRule(module, "caller", {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Run,
      });
      assertEquals(canSkipMemo(caller), false);
    },
  );

  await t.step(
    "REENTRANCY08 - an unresolved reference name is treated conservatively",
    () => {
      const module = DefaultModule();
      const caller = makeRule(module, "caller", resolveRef("missing"));
      assertEquals(canSkipMemo(caller), false);
    },
  );

  await t.step(
    "REENTRANCY09 - a special-rule reference is a concrete call edge",
    () => {
      const module = DefaultModule();
      const leaf = makeRule(module, "leaf", character);
      const caller = makeRule(module, "caller", {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Special,
        value: { kind: SpecialKind.Rule, rule: leaf },
      });
      assertEquals(canSkipMemo(caller), true);
    },
  );

  await t.step(
    "REENTRANCY10 - deeply nested structural patterns are traversed",
    () => {
      const module = DefaultModule();
      const leaf = makeRule(module, "leaf", character);
      const nested: Pattern = {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Maybe,
            pattern: {
              kind: PatternKind.Quantifier,
              pattern: resolveRef("group"),
            },
          },
        ],
      };
      const group = makeRule(module, "group", {
        kind: PatternKind.Switch,
        cases: [{
          key: {
            kind: "characterClass",
            characterClass: CharacterClass.Letter,
          },
          pattern: resolveRef("leaf"),
        }],
        default: nested,
      });
      // `group`'s `default` case reaches back into `group` via the nested
      // Then/Maybe/Quantifier chain, so it must remain memoized.
      assertEquals(canSkipMemo(group), false);
      assertEquals(canSkipMemo(leaf), true);
    },
  );
});
