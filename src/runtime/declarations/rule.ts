import { Pattern } from "../patterns/pattern.ts";
import { DeclarationKind } from "./declaration.kind.ts";

export type RuleDeclaration = {
  kind: DeclarationKind.Rule;
  name: string;
  pattern: Pattern;
};
