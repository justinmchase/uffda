import { Rule } from "./rule.ts";

export type Module = {
  moduleUrl: URL;
  imports: Map<string, Rule>;
  exports: Map<string, Rule>;
  rules: Map<string, Rule>;
};

export const DefaultModule: () => Module = () => ({
  moduleUrl: new URL(import.meta.url),
  imports: new Map(),
  exports: new Map(),
  rules: new Map(),
});
