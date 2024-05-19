import { Pattern } from "../patterns/mod.ts";

export type RuleDeclaration = {
  name: string;
  parameters: RuleParameter[];
  pattern: Pattern;
};

export type RuleParameter = {
  name: string;
};
