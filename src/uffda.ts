import { Scope } from "./scope.ts";
import { Resolver, run } from "./runtime/mod.ts";
import { hash } from "./runtime/hash.ts";
import { Compiler } from "./parsers/compiler/Compiler.ts";
import { Declaration, IModuleDeclaration } from "./runtime/declarations/mod.ts";
import { RuntimeError, RuntimeErrorCode } from "./runtime/runtime.error.ts";
import { IModule } from "./modules.ts";
import { DeclarationKind } from "./runtime/declarations/declaration.kind.ts";
import { serialize } from "./runtime/serialization/mod.ts";

const templateToCode = (template: TemplateStringsArray | string) =>
  typeof template === "string" ? template : template.reduce(
    (l, r, i) => `${l}$${i - 1}${r}`,
  );

async function argsToSpecials(
  resolver: Resolver,
  args: Declaration[],
): Promise<Map<string, IModule>> {
  const specials = new Map<string, IModule>();
  let i = 0;
  for (const arg of args) {
    const { kind } = arg;
    switch (kind) {
      case DeclarationKind.Module: {
        const modDecl = arg as IModuleDeclaration;
        const moduleUrl = `file://${hash(serialize(modDecl))}.json`;
        const mod = await resolver.load(moduleUrl, modDecl);
        specials.set(`$${i++}`, mod);
        break;
      }
      default:
        throw new RuntimeError(
          RuntimeErrorCode.UnknownSpecialKind,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            metadata: {
              i,
              special: arg,
            },
          },
        );
    }
  }
  return specials;
}

export type DslOptions = {
  resolver?: Resolver;
  trace?: boolean;
};

export function dsl<T>(
  moduleUrl: string,
  module: IModuleDeclaration,
  options?: DslOptions,
) {
  const { resolver, trace } = options ?? {};
  return async (
    template: TemplateStringsArray | string,
    ...args: Declaration[]
  ) => {
    const r = resolver ?? new Resolver({ moduleUrl });
    const dslCode = templateToCode(template);
    const specials = await argsToSpecials(r, args);
    const m = await r.load(moduleUrl, module);
    const s = Scope.From(dslCode, {
      resolver: r,
      module: m,
      specials,
      trace,
    });
    const match = run(s);
    const { done, matched, errors, value } = match;
    if (errors.length) {
      throw new RuntimeError(
        RuntimeErrorCode.MatchError,
        m,
        undefined,
        undefined,
        match,
        {
          cause: errors[0],
          metadata: { errors },
        },
      );
    }
    if (!done) {
      throw new RuntimeError(
        RuntimeErrorCode.StreamIncomplete,
        m,
        undefined,
        undefined,
        match,
        undefined,
      );
    }
    if (!matched) {
      throw new RuntimeError(
        RuntimeErrorCode.MatchError,
        m,
        undefined,
        undefined,
        match,
        undefined,
      );
    }

    return <T> value;
  };
}

export const uffda = (options?: DslOptions) =>
  dsl<IModuleDeclaration>(
    Resolver.normalizeModulePath(
      "./parsers/compiler/Compiler.ts",
      import.meta.url,
    ),
    Compiler,
    options,
  );
