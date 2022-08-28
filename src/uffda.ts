import { Scope } from "./scope.ts";
import { Meta } from "./parsers/mod.ts";
import {
  IRulePattern,
  match,
  Pattern,
  ProjectionFunction,
} from "./runtime/mod.ts";

const templateToCode = (template: TemplateStringsArray) =>
  template.reduce(
    (l, r, i) => `${l}$${i - 1}${r}`,
  );
const argsToSpecials = (args: (ProjectionFunction | IRulePattern)[]) =>
  args.reduce(
    (a, b, i) => Object.assign(a, { [`$${i}`]: b }),
    {},
  ) as Record<string, unknown>;

// function uffda<T>(template: TemplateStringsArray, ...args: T[]) {
//   const metaCode = templateToCode(template);
//   const specials = argsToSpecials(args);
//   const scope = Scope.From(metaCode).setSpecials(specials);
//   const { matched, done, value, errors } = match(Meta, scope);
//   assert(equal(errors, []), errors.join("\n"));
//   assert(done, "Parser failed to parse entire code");
//   assert(matched, "The parser failed to parse the provided code");
//   assert(value, "The parser did not produce a valid AST");
//   return dsl(value as Pattern);
// }

export function dsl(pattern: Pattern) {
  return (
    template: TemplateStringsArray,
    ...args: (ProjectionFunction | IRulePattern)[]
  ) => {
    const dslCode = templateToCode(template);
    const specials = argsToSpecials(args);
    const scope = Scope.From(dslCode).setSpecials(specials);
    return match(pattern, scope);
  };
}

export const uffda = dsl(Meta);
