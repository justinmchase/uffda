import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { lit } from "../../runtime/patterns/value_source.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { moduleDeclarationTest } from "../../test.ts";
import type { Expression } from "../../runtime/expressions/expression.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";
import type { RuleDeclaration } from "../../runtime/declarations/mod.ts";

const ref = (name: string, ...args: Pattern[]): Pattern => ({
  kind: PatternKind.Resolve,
  targetKind: ResolveTargetKind.Reference,
  name,
  args,
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
const rule = (
  name: string,
  pattern: Pattern,
  options: { parameters?: string[]; expression?: Expression } = {},
): RuleDeclaration => ({
  name,
  parameters: (options.parameters ?? []).map((name) => ({ name })),
  pattern,
  expression: options.expression,
});

type Case =
  & {
    rules: RuleDeclaration[];
    entry: string;
    input: string;
  }
  & (
    | { kind: MatchKind.Ok; value: unknown; done?: boolean }
    | { kind: MatchKind.Fail }
  );

/**
 * Runs `c` over its input supplied both as an immediately available iterable
 * and as an async iterable, asserting the same outcome for each.
 */
function cycleTest(c: Case) {
  const moduleUrl = `${import.meta.url}#${c.entry}-${c.input}`;
  const run = (input: Input) =>
    moduleDeclarationTest({
      moduleUrl,
      declarations: {
        [moduleUrl]: {
          imports: [],
          exports: c.rules.map(({ name }) => ({
            kind: ExportDeclarationKind.Rule,
            name,
            default: name === c.entry,
          })),
          rules: c.rules,
        },
      },
      input,
      ...(c.kind === MatchKind.Ok
        ? { kind: MatchKind.Ok, value: c.value, done: c.done }
        : { kind: MatchKind.Fail }),
    })();
  return async () => {
    await run(Input.Iterable(c.input));
    await run(Input.Iterable((async function* () {
      yield* c.input;
    })()));
  };
}

// A = B "x" | "a"; B = A "y" | "b"
const mutual = [
  rule("A", or(then(ref("B"), eq("x")), eq("a"))),
  rule("B", or(then(ref("A"), eq("y")), eq("b"))),
];

// E = T; T = E "+" "n" | "n"
const passThrough = [
  rule("E", ref("T")),
  rule("T", or(then(ref("E"), eq("+"), eq("n")), eq("n"))),
];

// E = F "e" | "x"; F = E "f" | G; G = F "g" | "y"
// Interwoven cycles E <- F <- E and F <- G <- F.
const interwoven = [
  rule("E", or(then(ref("F"), eq("e")), eq("x"))),
  rule("F", or(then(ref("E"), eq("f")), ref("G"))),
  rule("G", or(then(ref("F"), eq("g")), eq("y"))),
];

// Sum = Add "+" "n" | Mul; Add = Sum; Mul = Mul "*" "n" | "n"
// An independent left-recursive cycle (Mul) nested inside an indirect one.
const nested = [
  rule("Sum", or(then(ref("Add"), eq("+"), eq("n")), ref("Mul"))),
  rule("Add", ref("Sum")),
  rule("Mul", or(then(ref("Mul"), eq("*"), eq("n")), eq("n"))),
];

Deno.test("req:indirect-left-recursion-001 - Indirect and mutual left-recursive cycles grow like direct left recursion", async (t) => {
  await t.step(
    "mutual recursion grows through both rules when entered at A",
    cycleTest({
      rules: mutual,
      entry: "A",
      input: "ayxyx",
      kind: MatchKind.Ok,
      value: [[[["a", "y"], "x"], "y"], "x"],
    }),
  );

  await t.step(
    "mutual recursion grows through both rules when entered at B",
    cycleTest({
      rules: mutual,
      entry: "B",
      input: "bxyxy",
      kind: MatchKind.Ok,
      value: [[[["b", "x"], "y"], "x"], "y"],
    }),
  );

  await t.step(
    "mutual recursion stops at the longest fixed point",
    cycleTest({
      rules: mutual,
      entry: "A",
      input: "bxyz",
      kind: MatchKind.Ok,
      value: ["b", "x"],
      done: false,
    }),
  );

  await t.step(
    "indirect recursion through a pass-through rule folds left-associatively",
    cycleTest({
      rules: passThrough,
      entry: "E",
      input: "n+n+n",
      kind: MatchKind.Ok,
      value: [["n", "+", "n"], "+", "n"],
    }),
  );

  await t.step(
    "interwoven cycles grow each head to its fixed point",
    cycleTest({
      rules: interwoven,
      entry: "E",
      input: "ygge",
      kind: MatchKind.Ok,
      value: [[["y", "g"], "g"], "e"],
    }),
  );

  await t.step(
    "interwoven cycles alternate between their heads",
    cycleTest({
      rules: interwoven,
      entry: "E",
      input: "yggefe",
      kind: MatchKind.Ok,
      value: [[[[["y", "g"], "g"], "e"], "f"], "e"],
    }),
  );

  await t.step(
    "an independent direct cycle nested in an indirect cycle keeps its growth",
    cycleTest({
      rules: nested,
      entry: "Sum",
      input: "n*n*n+n+n",
      kind: MatchKind.Ok,
      value: [[[["n", "*", "n"], "*", "n"], "+", "n"], "+", "n"],
    }),
  );

  await t.step(
    "a cycle with no base case fails and terminates",
    cycleTest({
      rules: [rule("A", ref("B")), rule("B", ref("A"))],
      entry: "B",
      input: "ab",
      kind: MatchKind.Fail,
    }),
  );

  await t.step(
    "a cycle through a parameterized rule argument grows",
    cycleTest({
      // Main = Wrap<Main> "!" | "a"; Wrap<p> = p
      rules: [
        rule("Main", or(then(ref("Wrap", ref("Main")), eq("!")), eq("a"))),
        rule("Wrap", ref("p"), { parameters: ["p"] }),
      ],
      entry: "Main",
      input: "a!!",
      kind: MatchKind.Ok,
      value: [["a", "!"], "!"],
    }),
  );

  await t.step(
    "a cycle between parameterized rules sharing an argument grows",
    cycleTest({
      // Main = P<N>; P<x> = Q<x> "+" x | x; Q<x> = P<x>; N = "n"
      rules: [
        rule("Main", ref("P", ref("N"))),
        rule("P", or(then(ref("Q", ref("x")), eq("+"), ref("x")), ref("x")), {
          parameters: ["x"],
        }),
        rule("Q", ref("P", ref("x")), { parameters: ["x"] }),
        rule("N", eq("n")),
      ],
      entry: "Main",
      input: "n+n+n",
      kind: MatchKind.Ok,
      value: [["n", "+", "n"], "+", "n"],
    }),
  );

  await t.step(
    "involved rule projections apply on every growth iteration",
    cycleTest({
      // E = T; T = E "+" "n" -> ["add", _] | "n"
      rules: [
        rule("E", ref("T")),
        rule(
          "T",
          or(
            {
              kind: PatternKind.Projection,
              pattern: then(ref("E"), eq("+"), eq("n")),
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }: { _: unknown[] }) => Promise.resolve(["add", _[0]]),
              },
            },
            eq("n"),
          ),
        ),
      ],
      entry: "E",
      input: "n+n+n",
      kind: MatchKind.Ok,
      value: ["add", ["add", "n"]],
    }),
  );
});
