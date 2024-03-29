import { Import } from "./import.ts";
import { ModuleKind } from "./moduleKind.ts";
import { Rule } from "./rule.ts";

export type Module = {
  kind: ModuleKind.Module;
  moduleUrl: URL;
  imports: Map<string, Import>;
  rules: Map<string, Rule>;
};

export const DefaultModule: () => Module = () => ({
  kind: ModuleKind.Module,
  moduleUrl: new URL(import.meta.url),
  imports: new Map(),
  rules: new Map(),
});
