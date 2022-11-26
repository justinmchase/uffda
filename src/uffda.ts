// import { Scope } from "./scope.ts";
// import { Resolver, run } from "./runtime/mod.ts";
// import { Compiler } from "./parsers/compiler/Compiler.ts";
// import { IModuleDeclaration } from "./runtime/declarations/module.ts";

// const templateToCode = (template: TemplateStringsArray) =>
//   template.reduce(
//     (l, r, i) => `${l}$${i - 1}${r}`,
//   );
// const argsToSpecials = (args: unknown[]) =>
//   args.reduce<Record<string, unknown>>(
//     (a, b, i) => Object.assign(a, { [`$${i}`]: b }),
//     {},
//   );

// export function code(
//   template: TemplateStringsArray,
//   ...args: unknown[]
// ): Scope {
//   const dslCode = templateToCode(template);
//   const specials = argsToSpecials(args);
//   return Scope.From(dslCode, {
//     specials
//   })
// };

// export function dsl<T>(moduleUrl: string, module: IModuleDeclaration, resolver?: Resolver) {
//   return async (template: TemplateStringsArray, ...args: unknown[] ) => {     
//     const dslCode = templateToCode(template);
//     const specials = argsToSpecials(args);
//     const r = resolver ?? new Resolver(moduleUrl)
//     const m = await r.load(moduleUrl, module)
//     const s = Scope.From(dslCode, {
//       module: m,
//       specials
//     })
//     return await run<T>(s)
//   }
// }

// export const uffda = dsl<IModuleDeclaration>(
//   Resolver.normalizeModulePath("./parsers/compiler/Compiler.ts", import.meta.url),
//   Compiler
// );
