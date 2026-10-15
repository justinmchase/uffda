import { assert } from "@std/assert";
import { Type, type } from "@justinmchase/type";
import behaviorFixtures from "../../../test/rust/globals-fixtures.json" with {
  type: "json",
};
import surfaceFixtures from "../../../test/rust/globals-surface-fixtures.json" with {
  type: "json",
};
import { metadataOf } from "../value_metadata.ts";
import { defaultGlobals } from "./mod.ts";

function invocationNames(value: unknown): Set<string> {
  const names = new Set<string>();
  const [kind, current] = type(value);
  switch (kind) {
    case Type.Array:
      for (const item of current) {
        for (const name of invocationNames(item)) names.add(name);
      }
      break;
    case Type.Object: {
      const record = current as Record<string, unknown>;
      if (
        record.kind === "invocation" &&
        type(record.expression)[0] === Type.Object
      ) {
        const expression = record.expression as Record<string, unknown>;
        if (
          expression.kind === "reference" &&
          type(expression.name)[0] === Type.String
        ) {
          names.add(expression.name as string);
        }
      }
      for (const item of Object.values(record)) {
        for (const name of invocationNames(item)) names.add(name);
      }
      break;
    }
    default:
      break;
  }
  return names;
}

Deno.test("req:standard-library-001 req:standard-library-002 - default global names and arities match shared fixture", () => {
  const expectedNames = surfaceFixtures.map((fixture) => fixture.name).sort();
  const actualNames = [...defaultGlobals.keys()].sort();
  assert(
    new Set(expectedNames).size === expectedNames.length,
    "global surface fixture contains duplicate names",
  );
  assert(
    actualNames.length === expectedNames.length &&
      actualNames.every((name, index) => name === expectedNames[index]),
    `default globals differ from shared fixture: ${actualNames.join(", ")}`,
  );
  const behaviorNames = new Set<string>();
  const behaviorCaseCounts = new Map<string, number>();
  for (const fixture of behaviorFixtures) {
    const names = new Set([fixture.name]);
    for (const name of invocationNames(fixture.expressions)) {
      names.add(name);
    }
    for (const name of names) {
      behaviorNames.add(name);
      behaviorCaseCounts.set(
        name,
        (behaviorCaseCounts.get(name) ?? 0) + 1,
      );
    }
  }
  assert(
    expectedNames.every((name) => behaviorNames.has(name)),
    "shared behavior corpus does not cover every default global",
  );
  assert(
    surfaceFixtures.every((fixture) =>
      (behaviorCaseCounts.get(fixture.name) ?? 0) >= 2
    ),
    "shared behavior corpus must include at least two cases for every default global",
  );
  for (const fixture of surfaceFixtures) {
    const fn = defaultGlobals.get(fixture.name) as
      | { name: string; length: number }
      | undefined;
    assert(fn, `${fixture.name} is missing`);
    assert(
      fn.name === fixture.name,
      `${fixture.name} has the wrong function name`,
    );
    assert(fn.length === fixture.arity, `${fixture.name} has the wrong arity`);
    const metadata = metadataOf(fn);
    assert(metadata, `${fixture.name} has no metadata`);
    assert(
      metadata.description.length > 0,
      `${fixture.name} has no description`,
    );
  }
});
