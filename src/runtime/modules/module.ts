import type { DecoratorFunc } from "./decorator.ts";
import type { Func } from "./func.ts";
import type { Rule } from "./rule.ts";

export type ModuleMember = Rule | Func;

export type Module = {
  moduleUrl: URL;
  imports: Map<string, ModuleMember>;
  exports: Map<string, ModuleMember | DecoratorFunc>;
  rules: Map<string, Rule>;
  funcs: Map<string, Func>;
  /** `decorator` declarations; a namespace separate from `funcs`/`imports`. */
  decorators: Map<string, DecoratorFunc>;
  /** Imported decorators; a namespace separate from `imports`. */
  decoratorImports: Map<string, DecoratorFunc>;
  default: ModuleMember | DecoratorFunc | undefined;
};

export const DefaultModule: () => Module = () => ({
  moduleUrl: new URL(import.meta.url),
  imports: new Map(),
  exports: new Map(),
  rules: new Map(),
  funcs: new Map(),
  decorators: new Map(),
  decoratorImports: new Map(),
  default: undefined,
});
