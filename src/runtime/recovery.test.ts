import { assert, assertEquals } from "@std/assert";
import { Input } from "../input.ts";
import { MatchErrorCode, MatchKind } from "../match.ts";
import { Resolver } from "./resolve.ts";
import { Scope } from "./scope.ts";
import { collectRecoveries, matchWithRecovery } from "./recovery.ts";
import { match } from "./match.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import {
  type Pattern,
  type ResolvePattern,
  ResolveTargetKind,
} from "./patterns/pattern.ts";
import { lit } from "./patterns/value_source.ts";
import { ModuleImportResultKind } from "./resolvers/resolver.ts";
import { ExportDeclarationKind } from "./declarations/mod.ts";
import type { RuleDeclaration } from "./declarations/mod.ts";

const equal = (value: string): Pattern => ({
  kind: PatternKind.Equal,
  value: lit(value),
});
const ref = (name: string): Pattern => ({
  kind: PatternKind.Resolve,
  targetKind: ResolveTargetKind.Reference,
  name,
  args: [],
});
const run: ResolvePattern = {
  kind: PatternKind.Resolve,
  targetKind: ResolveTargetKind.Run,
};

// Module = (Stmt ";")* end
// Stmt   = recover ("a" "b") skip (not ";" any)+
const statements: RuleDeclaration[] = [
  {
    name: "Module",
    parameters: [],
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Quantifier,
          pattern: {
            kind: PatternKind.Then,
            patterns: [ref("Stmt"), equal(";")],
          },
        },
        { kind: PatternKind.End },
      ],
    },
  },
  {
    name: "Stmt",
    parameters: [],
    pattern: {
      kind: PatternKind.Recover,
      pattern: { kind: PatternKind.Then, patterns: [equal("a"), equal("b")] },
      skip: {
        kind: PatternKind.Quantifier,
        min: lit(1),
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Not, pattern: equal(";") },
            { kind: PatternKind.Any },
          ],
        },
      },
    },
  },
];

async function moduleScope(
  rules: RuleDeclaration[],
  input: string,
): Promise<Scope> {
  const moduleUrl = "file:///recovery.test.ts";
  const resolver = new Resolver({
    declarations: {
      [moduleUrl]: {
        imports: [],
        exports: [{
          kind: ExportDeclarationKind.Rule,
          name: rules[0].name,
          default: true,
        }],
        rules,
      },
    },
  });
  const imported = await resolver.import(new URL(moduleUrl), {
    scope: Scope.Default().withOptions({ resolver }),
    pattern: run,
  });
  assert(imported.kind === ModuleImportResultKind.Module);
  return new Scope(
    imported.module,
    undefined,
    undefined,
    undefined,
    Input.Iterable(input),
    undefined,
    undefined,
    { resolver },
  );
}

const spans = (m: Awaited<ReturnType<typeof match>>) =>
  collectRecoveries(m).map(({ match }) => [
    match.span.start.toString(),
    match.span.end.toString(),
  ]);

Deno.test("runtime.recovery", async (t) => {
  await t.step(
    "RECOVERY00 - a clean parse is the first phase's result",
    async () => {
      const m = await matchWithRecovery(
        run,
        await moduleScope(statements, "ab;ab;"),
      );
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.recovered, undefined);
      assertEquals(m.scope.recovery, false);
      assertEquals(collectRecoveries(m), []);
    },
  );

  await t.step(
    "RECOVERY01 - a failed parse is recovered in the second phase",
    async () => {
      const m = await matchWithRecovery(
        run,
        await moduleScope(statements, "ab;xx;ab;"),
      );
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.recovered, true);
      assertEquals(spans(m), [["[3]", "[5]"]]);
      const [{ failure }] = collectRecoveries(m);
      assertEquals(failure.kind, MatchKind.Fail);
    },
  );

  await t.step(
    "RECOVERY02 - recoveries are collected in document order",
    async () => {
      const m = await matchWithRecovery(
        run,
        await moduleScope(statements, "xx;ab;yyy;"),
      );
      assert(m.kind === MatchKind.Ok);
      assertEquals(spans(m), [["[0]", "[2]"], ["[6]", "[9]"]]);
    },
  );

  await t.step(
    "RECOVERY03 - recoveries beneath a failed second phase are collected",
    async () => {
      const m = await matchWithRecovery(
        run,
        await moduleScope(statements, "xx;;"),
      );
      assertEquals(m.kind, MatchKind.Fail);
      assertEquals(spans(m), [["[0]", "[2]"]]);
    },
  );

  await t.step(
    "RECOVERY04 - an error ends matching without a second phase",
    async () => {
      const m = await matchWithRecovery(
        ref("Missing"),
        await moduleScope(statements, "ab;"),
      );
      assert(m.kind === MatchKind.Error);
      assertEquals(m.code, MatchErrorCode.UnknownReference);
    },
  );

  await t.step(
    "RECOVERY05 - memo entries are isolated by recovery setting",
    async () => {
      // Within Probe's frame, `not Stmt` memoizes Stmt at [0] with recovery
      // disabled; the following Stmt must not reuse that failure. `fail
      // Stmt` is never taken; its static self-reference keeps Stmt memoized.
      const [, stmt] = statements;
      const probe: RuleDeclaration = {
        name: "Probe",
        parameters: [],
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            { kind: PatternKind.Not, pattern: ref("Stmt") },
            ref("Stmt"),
          ],
        },
      };
      const memoized: RuleDeclaration = {
        ...stmt,
        pattern: {
          kind: PatternKind.Or,
          patterns: [stmt.pattern, {
            kind: PatternKind.Then,
            patterns: [{ kind: PatternKind.Fail }, ref("Stmt")],
          }],
        },
      };
      const m = await match(
        run,
        (await moduleScope([probe, memoized], "xx;")).withRecovery(true),
      );
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.recovered, true);
      assertEquals(spans(m), [["[0]", "[2]"]]);
    },
  );

  await t.step(
    "RECOVERY06 - recoveries in rejected attempts are not collected",
    async () => {
      const m = await match(
        {
          kind: PatternKind.Or,
          patterns: [statements[1].pattern, equal("x")],
        },
        Scope.From(Input.Iterable("x")).withRecovery(true),
      );
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.matches[0].kind, MatchKind.Fail);
      assertEquals(collectRecoveries(m), []);
    },
  );

  await t.step(
    "RECOVERY07 - no failed recovery point skips the second phase",
    async () => {
      const skipped = await matchWithRecovery(
        run,
        await moduleScope(statements, "ab;ab"),
      );
      assertEquals(skipped.kind, MatchKind.Fail);
      assertEquals(skipped.scope.recovery, false);

      const recovered = await matchWithRecovery(
        run,
        await moduleScope(statements, "xx;;"),
      );
      assertEquals(recovered.kind, MatchKind.Fail);
      assertEquals(recovered.scope.recovery, true);
    },
  );
});
