import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";
import type { RuleDeclaration } from "../../runtime/declarations/mod.ts";

const ref = (name: string): Pattern => ({
  kind: PatternKind.Resolve,
  targetKind: ResolveTargetKind.Reference,
  name,
  args: [],
});
const eq = (value: string): Pattern => ({
  kind: PatternKind.Equal,
  value: lit(value),
});
const then = (...patterns: Pattern[]): Pattern => ({
  kind: PatternKind.Then,
  patterns,
});
const or = (...patterns: Pattern[]): Pattern => ({
  kind: PatternKind.Or,
  patterns,
});
const rule = (name: string, pattern: Pattern): RuleDeclaration => ({
  name,
  parameters: [],
  pattern,
});

function grammarTest(
  name: string,
  rules: RuleDeclaration[],
  input: string,
  value: unknown,
) {
  const moduleUrl = `${import.meta.url}#${name}`;
  return moduleDeclarationTest({
    moduleUrl,
    declarations: {
      [moduleUrl]: {
        imports: [],
        exports: rules.map((r, i) => ({
          kind: ExportDeclarationKind.Rule,
          name: r.name,
          default: i === 0,
        })),
        rules,
      },
    },
    input: Input.Iterable(input),
    kind: MatchKind.Ok,
    value,
  });
}

Deno.test("req:indirect-left-recursion-002 - Outcomes computed against a left-recursive seed are reused only while that seed is current", async (t) => {
  await t.step(
    "an outcome that observed a seed only through another rule is recomputed each iteration",
    // A = B "q" | Y "x" | "a"; Y = B; B = A "y" | "b"
    grammarTest(
      "transitive",
      [
        rule(
          "A",
          or(then(ref("B"), eq("q")), then(ref("Y"), eq("x")), eq("a")),
        ),
        rule("Y", ref("B")),
        rule("B", or(then(ref("A"), eq("y")), eq("b"))),
      ],
      "ayx",
      [["a", "y"], "x"],
    ),
  );

  await t.step(
    "an outcome from a superseded iteration is recomputed after growth completes",
    // Main = H "#" | X; H = H "!" | H | X; X = H "?" | "n"
    // X is last evaluated in H's first iteration, against a seed H outgrows.
    grammarTest(
      "superseded",
      [
        rule("Main", or(then(ref("H"), eq("#")), ref("X"))),
        rule("H", or(then(ref("H"), eq("!")), ref("H"), ref("X"))),
        rule("X", or(then(ref("H"), eq("?")), eq("n"))),
      ],
      "n?",
      ["n", "?"],
    ),
  );

  await t.step(
    "an outcome from the final iteration is reused after growth completes",
    // Main = A "!" | B; A = B "x" | "a"; B = A "y" | "b"
    grammarTest(
      "final",
      [
        rule("Main", or(then(ref("A"), eq("!")), ref("B"))),
        rule("A", or(then(ref("B"), eq("x")), eq("a"))),
        rule("B", or(then(ref("A"), eq("y")), eq("b"))),
      ],
      "ayxy",
      [[["a", "y"], "x"], "y"],
    ),
  );

  await t.step(
    "an outcome computed against the current seed is reused within the same iteration",
    async () => {
      let evaluations = 0;
      const counted: Pattern = {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Ok },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => evaluations++,
        },
      };
      // A = B "q" | B "x" | "a"; B = <count> (A "y" | "b")
      await grammarTest(
        "within-iteration",
        [
          rule(
            "A",
            or(then(ref("B"), eq("q")), then(ref("B"), eq("x")), eq("a")),
          ),
          rule("B", then(counted, or(then(ref("A"), eq("y")), eq("b")))),
        ],
        "ayx",
        [[2, ["a", "y"]], "x"],
      )();
      // Once while detecting the cycle, then once per growth iteration (three)
      // rather than once per call site.
      assertEquals(evaluations, 4);
    },
  );
});
