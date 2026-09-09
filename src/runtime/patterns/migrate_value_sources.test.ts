import { assertEquals } from "@std/assert";
import type { ModuleDeclaration } from "../declarations/module.ts";
import { PatternKind } from "./pattern.kind.ts";
import { migrateModuleValueSources } from "./migrate_value_sources.ts";
import { ValueSourceKind } from "./value_source.ts";

Deno.test("migrateModuleValueSources wraps bare equal/between/includes/quantifier operands", () => {
  const module: ModuleDeclaration = {
    imports: [],
    exports: [],
    rules: [
      {
        name: "R",
        parameters: [],
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Equal, value: "a" as unknown as never },
            {
              kind: PatternKind.Between,
              left: 0 as unknown as never,
              right: 1 as unknown as never,
            },
            {
              kind: PatternKind.Includes,
              values: ["x", "y"] as unknown as never,
            },
            {
              kind: PatternKind.Quantifier,
              pattern: { kind: PatternKind.Any },
              min: 2 as unknown as never,
              max: 3 as unknown as never,
            },
          ],
        },
      },
    ],
  };

  migrateModuleValueSources(module);

  const patterns = module.rules[0].pattern;
  if (patterns.kind !== PatternKind.Then) throw new Error("expected then");
  const [eq, between, includes, quant] = patterns.patterns;

  assertEquals(eq, {
    kind: PatternKind.Equal,
    value: { kind: ValueSourceKind.Literal, value: "a" },
  });
  assertEquals(between, {
    kind: PatternKind.Between,
    left: { kind: ValueSourceKind.Literal, value: 0 },
    right: { kind: ValueSourceKind.Literal, value: 1 },
  });
  assertEquals(includes, {
    kind: PatternKind.Includes,
    values: [
      { kind: ValueSourceKind.Literal, value: "x" },
      { kind: ValueSourceKind.Literal, value: "y" },
    ],
  });
  assertEquals(quant, {
    kind: PatternKind.Quantifier,
    pattern: { kind: PatternKind.Any },
    min: { kind: ValueSourceKind.Literal, value: 2 },
    max: { kind: ValueSourceKind.Literal, value: 3 },
  });
});
