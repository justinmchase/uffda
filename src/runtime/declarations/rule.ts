import { Pattern } from "../patterns/mod.ts";
import { DeclarationKind } from "./declaration.kind.ts";

export type RuleDeclaration = {
  kind: DeclarationKind.Rule;
  name: string;
  parameters: RuleParameter[];
  pattern: Pattern;
};

export type RuleParameter = {
  name: string;
};
