import type { Func } from "./func.ts";
import type { Rule } from "./rule.ts";

export type ModuleMember = Rule | Func;

export type Module = {
  moduleUrl: URL;
  imports: Map<string, ModuleMember>;
  exports: Map<string, ModuleMember>;
  rules: Map<string, Rule>;
  funcs: Map<string, Func>;
  default: ModuleMember | undefined;
};

export const DefaultModule: () => Module = () => ({
  moduleUrl: new URL(import.meta.url),
  imports: new Map(),
  exports: new Map(),
  rules: new Map(),
  funcs: new Map(),
  default: undefined,
});
