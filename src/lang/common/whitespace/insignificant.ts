import { Type } from "@justinmchase/type";
import {
  ExportDeclarationKind,
  type ModuleDeclaration,
} from "../../../runtime/declarations/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";

export const Insignificant: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Insignificant",
      default: true,
    },
  ],
  rules: [
    {
      name: "Insignificant",
      parameters: [],
      pattern: {
        kind: PatternKind.Slice,
        pattern: {
          kind: PatternKind.Type,
          type: Type.Unknown,
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => {
          // Filter out whitespace and newline tokens
          // Whitespace tokens are strings that contain only whitespace characters
          // Newline tokens are the string "\n"
          const filtered = _.filter((token: unknown) => {
            if (typeof token === "string") {
              // Check if it's a whitespace-only token or newline token
              const isWhitespace = token.trim() === "";
              return !isWhitespace;
            }
            // Keep non-string tokens (these would be expression objects, etc.)
            return true;
          });

          // For objects that might contain nested expressions (like StringExpression),
          // we need to recursively process them
          return filtered.map((item: unknown) => {
            if (
              typeof item === "object" && item !== null &&
              "kind" in item && item.kind === ExpressionKind.String
            ) {
              // This is a StringExpression with potential interpolations
              const stringExpr = item as {
                kind: number;
                values: unknown[];
              };
              // Process the values array to remove whitespace from interpolated expressions
              // but keep whitespace in string content
              return {
                ...stringExpr,
                values: stringExpr.values.map((value: unknown) => {
                  // String content should be kept as is
                  if (typeof value === "string") {
                    return value;
                  }
                  // For interpolated expressions (objects), recursively filter whitespace
                  // This handles cases like "{add 1 2}" where we want to remove whitespace around "add", "1", "2"
                  if (
                    typeof value === "object" && value !== null &&
                    Array.isArray(value)
                  ) {
                    // If it's an array, recursively filter it
                    return value.filter((token: unknown) => {
                      if (typeof token === "string") {
                        return token.trim() !== "";
                      }
                      return true;
                    });
                  }
                  return value;
                }),
              };
            }
            return item;
          });
        },
      },
    },
  ],
};

export default Insignificant;
