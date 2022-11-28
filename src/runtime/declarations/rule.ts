import { Pattern } from "../patterns/pattern.ts";
import { DeclarationKind } from "./declaration.kind.ts";

export interface IRuleDeclaration {
  kind: DeclarationKind.Rule;
  name: string;
  pattern: Pattern;
}
