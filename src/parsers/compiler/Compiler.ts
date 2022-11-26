// import { PatternKind } from "../../runtime/patterns/mod.ts";
// import { Lang } from "../lang/Lang.ts";
// import { PatternModule } from "./PatternModule.ts";
// import * as Declarations from "./declarations/mod.ts";
// import * as Patterns from "./patterns/mod.ts";
// import * as Expressions from "./expressions/mod.ts";
// import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
// import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

// export const Compiler: IModuleDeclaration = {
//   kind: DeclarationKind.Module,
//   imports: [],
//   patterns: [
//     {
//       kind: DeclarationKind.Pattern,
//       name: "Compiler",
//       pattern: {
//         kind: PatternKind.Rule,
//         pattern: {
//           kind: PatternKind.Block,
//           rules: {
//             Lang,
//             ...Patterns,
//             ...Expressions,
//             ...Declarations,
//             PatternModule,
//             Main: {
//               kind: PatternKind.Rule,
//               pattern: {
//                 kind: PatternKind.Pipeline,
//                 steps: [
//                   { kind: PatternKind.Reference, name: "Lang" },
//                   { kind: PatternKind.Reference, name: "PatternModule" },
//                 ],
//               },
//             },
//           },
//         },
//       }
//     }
//   ]
// };
