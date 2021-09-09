import { assert, equal } from "../deps/std.ts";
import { Scope } from "./scope.ts";
import { Meta } from "./parsers/mod.ts";
import { match, Pattern } from "./runtime/mod.ts";

const templateToCode = (template: TemplateStringsArray) =>
  template.reduce(
    (l, r, i) => `${l}$${i - 1}${r}`,
  );
const argsToSpecials = (args: unknown[]) =>
  args.reduce(
    (a, b, i) => Object.assign(a, { [`$${i}`]: b }),
    {},
  ) as Record<string, unknown>;

export function dsl(
  pattern: Pattern,
  template: TemplateStringsArray,
  ...args: unknown[]
) {
  const dslCode = templateToCode(template);
  const specials = argsToSpecials(args);
  const scope = Scope.From(dslCode).setSpecials(specials);
  return match(pattern, scope);
}

export function uffda<T>(template: TemplateStringsArray, ...args: T[]) {
  const metaCode = templateToCode(template);
  const specials = argsToSpecials(args);
  const scope = Scope.From(metaCode).setSpecials(specials);
  const { matched, done, value, errors } = match(Meta, scope);
  assert(equal(errors, []), errors.join("\n"));
  assert(done, "Parser failed to parse entire code");
  assert(matched, "The parser failed to parse the provided code");
  assert(value, "The parser did not produce a valid AST");
  return (template: TemplateStringsArray, ...args: unknown[]) =>
    dsl(value as Pattern, template, ...args);
}
