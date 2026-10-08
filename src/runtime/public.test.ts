import { assert, assertEquals, assertThrows } from "@std/assert";
import { isClean, valueOf } from "../match.ts";
import {
  evaluateExpression,
  exec,
  ExpressionKind,
  InputNormalizationMode,
  match,
  PatternKind,
  Resolver,
  Scope,
} from "./public.ts";
import type {
  ArtifactLayout,
  Expression,
  ImportMap,
  IPackageResolver,
  Pattern,
  ResolverOptions,
} from "./public.ts";
import { Scope as RootScope } from "../mod.ts";
import type { ScopeOptions } from "./public.ts";

Deno.test(
  "req:cli-distribution-007 - public runtime executes typed patterns",
  async () => {
    const pattern: Pattern = { kind: PatternKind.Any };
    const result = await match(
      pattern,
      Scope.From(["token"], { kind: InputNormalizationMode.Iterable }),
    );
    assert(isClean(result));
    assertEquals(valueOf(result), "token");
    const emptyGlobals = new Map<string, unknown>();
    const isolatedScope = Scope.Default().withOptions({
      globals: emptyGlobals,
      specials: new Map(),
    });
    assertEquals(isolatedScope.options.globals, emptyGlobals);
    assert(RootScope === Scope);

    const configuredResolver: ResolverOptions = {
      artifacts: { root: "/tmp/project", outDir: "/tmp/project/bin" },
      imports: new Map() satisfies ImportMap,
    };
    const layout: ArtifactLayout = configuredResolver.artifacts!;
    const packages: IPackageResolver | undefined = undefined;
    const scopeOptions: Partial<ScopeOptions> = {
      resolver: new Resolver(configuredResolver),
      globals: emptyGlobals,
    };
    assertEquals([layout.root, packages, scopeOptions.globals], [
      "/tmp/project",
      undefined,
      emptyGlobals,
    ]);
    assertThrows(
      () =>
        evaluateExpression({
          kind: ExpressionKind.Reference,
          name: "add",
        }, { scope: isolatedScope }),
      ReferenceError,
      "unknown reference: add",
    );
    assert(typeof exec === "function");
  },
);

Deno.test(
  "req:cli-distribution-007 - public expression evaluator resolves input and variables",
  async () => {
    const inputExpression: Expression = {
      kind: ExpressionKind.Reference,
      name: "_",
    };
    const stateExpression: Expression = {
      kind: ExpressionKind.Reference,
      name: "state",
    };
    assertEquals(
      await evaluateExpression(inputExpression, { input: "event" }),
      "event",
    );
    assertEquals(
      await evaluateExpression(stateExpression, {
        variables: { state: { count: 3 } },
      }),
      { count: 3 },
    );
  },
);
