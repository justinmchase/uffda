import { assertEquals, assertStrictEquals } from "@std/assert";
import { VariableScope } from "./variable_scope.ts";

Deno.test("runtime.variable_scope", async (t) => {
  await t.step({
    name: "VARIABLE_SCOPE00",
    // From() normalizes a Record, a Map, or an existing VariableScope; an
    // existing VariableScope is returned untouched (no copy).
    fn: () => {
      const fromRecord = VariableScope.From({ a: 1 });
      assertEquals(fromRecord.get("a"), 1);

      const fromMap = VariableScope.From(new Map([["b", 2]]));
      assertEquals(fromMap.get("b"), 2);

      assertStrictEquals(VariableScope.From(fromMap), fromMap);
      assertStrictEquals(VariableScope.From(), VariableScope.Empty);
    },
  });

  await t.step({
    name: "VARIABLE_SCOPE01",
    // with() layers new bindings over the existing view without mutating
    // it, and a binding not present anywhere resolves to undefined.
    fn: () => {
      const base = VariableScope.From({ a: 1 });
      const next = base.with({ b: 2 });

      assertEquals(next.get("a"), 1);
      assertEquals(next.get("b"), 2);
      assertEquals(next.has("a"), true);
      assertEquals(next.has("c"), false);
      assertEquals(next.get("c"), undefined);

      // The base view is unaffected by the derived one.
      assertEquals(base.has("b"), false);
    },
  });

  await t.step({
    name: "VARIABLE_SCOPE02",
    // A later layer shadows an earlier binding of the same name, matching
    // the override semantics of the old `new Map([...old, ...new])` flatten.
    fn: () => {
      const base = VariableScope.From({ a: 1 });
      const shadowed = base.with({ a: 2 });

      assertEquals(shadowed.get("a"), 2);
      assertEquals(base.get("a"), 1);
    },
  });

  await t.step({
    name: "VARIABLE_SCOPE03",
    // with({}) (no new bindings) is a no-op that returns the same instance,
    // avoiding an allocation when nothing was actually added.
    fn: () => {
      const base = VariableScope.From({ a: 1 });
      assertStrictEquals(base.with({}), base);
      assertStrictEquals(base.with(new Map()), base);
    },
  });

  await t.step({
    name: "VARIABLE_SCOPE04",
    // withScope() folds another chain's full effective bindings on top of
    // this one, with the other chain's bindings shadowing this one's.
    fn: () => {
      const base = VariableScope.From({ a: 1, b: 1 });
      const other = VariableScope.From({ b: 2 }).with({ c: 3 });
      const merged = base.withScope(other);

      assertEquals(merged.get("a"), 1);
      assertEquals(merged.get("b"), 2);
      assertEquals(merged.get("c"), 3);
    },
  });

  await t.step({
    name: "VARIABLE_SCOPE05",
    // withScope(Empty) and withScope(this) are no-ops that return the same
    // instance.
    fn: () => {
      const base = VariableScope.From({ a: 1 });
      assertStrictEquals(base.withScope(VariableScope.Empty), base);
      assertStrictEquals(base.withScope(base), base);
    },
  });

  await t.step({
    name: "VARIABLE_SCOPE06",
    // size and entries()/[Symbol.iterator] reflect the full flattened view
    // (own bindings plus every ancestor's, with shadowing applied), even
    // though nothing is actually flattened until one of these is used.
    fn: () => {
      const scope = VariableScope.From({ a: 1 })
        .with({ b: 2 })
        .with({ a: 3 });

      assertEquals(scope.size, 2);
      assertEquals(new Map(scope.entries()), new Map([["a", 3], ["b", 2]]));
      assertEquals(new Map([...scope]), new Map([["a", 3], ["b", 2]]));
    },
  });

  await t.step({
    name: "VARIABLE_SCOPE07",
    // Chaining more layers than MaxDepth flattens instead of growing the
    // chain further, so lookups stay bounded — this is only observable
    // indirectly (correctness of the resulting bindings), since depth is a
    // private implementation detail.
    fn: () => {
      let scope = VariableScope.Empty;
      for (let i = 0; i < 50; i++) {
        scope = scope.with({ [`v${i}`]: i });
      }

      assertEquals(scope.size, 50);
      for (let i = 0; i < 50; i++) {
        assertEquals(scope.get(`v${i}`), i);
      }
    },
  });
});
