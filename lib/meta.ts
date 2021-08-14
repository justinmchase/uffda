import { assert } from "../deps/std.ts";
import { Scope } from "./scope.ts";
import { Meta } from "./parsers/mod.ts";
import { match, Pattern } from "./runtime/mod.ts";

export function meta<T>(template: TemplateStringsArray, ...args: T[]) {
  let metaCode = "";
  for (let i = 0, n = template.length; i < n; i++) {
    const a = template[i];
    metaCode += a;
    if (i < args.length) {
      metaCode += `$${i}`;
    }
  }

  const variables = args.reduce(
    (a, b, i) => Object.assign(a, { [`$${i}`]: b }),
    {},
  ) as Record<string, unknown>;
  const scope = Scope
    .From(metaCode)
    .setSpeical(variables)
    .push();

  // console.log(metaCode)

  const { matched, done, value: ast } = match(Meta, scope);

  console.log(Deno.inspect(ast, { colors: true }));
  assert(matched);
  assert(done);
  assert(ast);
  return function dsl(
    template: TemplateStringsArray,
    ...values: unknown[]
  ): unknown {
    let dslCode = "";
    for (let i = 0, n = template.length; i < n; i++) {
      const a = template[i];
      dslCode += a;
      if (i < values.length) {
        dslCode += `$${i}`;
      }
    }

    const variables = values.reduce(
      (a, b, i) => Object.assign(a, { [`$${i}`]: b }),
      {},
    ) as Record<string, unknown>;
    const scope = Scope
      .From(dslCode)
      .setSpeical(variables);

    const { matched, done, value: result } = match(ast as Pattern, scope);
    assert(matched);
    assert(done);
    assert(result);

    return result;
  };
}
