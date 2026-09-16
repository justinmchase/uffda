import { assertEquals } from "@std/assert";
import { describePattern, expectation } from "./match.describe_pattern.ts";
import { PatternKind } from "./runtime/patterns/pattern.kind.ts";
import { lit } from "./runtime/patterns/value_source.ts";
import { ResolveTargetKind } from "./runtime/patterns/pattern.ts";

Deno.test("match.describe_pattern", async (t) => {
  await t.step("describes equal with its expected literal", () => {
    assertEquals(
      describePattern({
        kind: PatternKind.Equal,
        value: lit(":"),
      }),
      'equal ":"',
    );
    assertEquals(
      expectation({ kind: PatternKind.Equal, value: lit(";") }),
      '";"',
    );
  });

  await t.step("describes resolve with its target name", () => {
    assertEquals(
      describePattern({
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "RuleParameterList",
        args: [],
      }),
      "resolve RuleParameterList",
    );
  });

  await t.step("describes variable wrappers around an inner pattern", () => {
    assertEquals(
      describePattern({
        kind: PatternKind.Variable,
        name: "t",
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "ImportModuleSpecifier",
          args: [],
        },
      }),
      "t: resolve ImportModuleSpecifier",
    );
  });

  await t.step("describes resolve targets as expectations", () => {
    // Resolve names belong in `describePattern` / the rule stack, not Expected.
    assertEquals(
      expectation({
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "ImportModuleSpecifier",
        args: [],
      }),
      undefined,
    );
  });
});
