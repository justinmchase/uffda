// import { tests } from "../../test.ts";
// import { ExpressionKind } from "../expressions/mod.ts";
// import { PatternKind } from "./pattern.kind.ts";

// tests("patterns.special", () => [
//   {
//     id: "SPECIAL00",
//     description: "gets special correctly",
//     pattern: () => ({
//       kind: PatternKind.Special,
//       name: "$0"
//     }),
//     specials: {
//       $0: 7
//     },
//     input: [],
//     value: 7,
//   },
//   {
//     id: "SPECIAL01",
//     description: "can get specials in pipeline steps",
//     pattern: () => ({
//       kind: PatternKind.Pipeline,
//       steps: [
//         {
//           kind: PatternKind.Special,
//           name: "$0"
//         },
//         {
//           kind: PatternKind.Then,
//           patterns: [
//             {
//               kind: PatternKind.Equal,
//               value: 7
//             },
//             {
//               kind: PatternKind.Special,
//               name: "$1"
//             }
//           ]
//         }
//       ]
//     }),
//     specials: {
//       $0: 7,
//       $1: 11
//     },
//     input: [],
//     value: [7, 11],
//   },
//   {
//     id: "SPECIAL02",
//     description: "special in and",
//     pattern: () => ({
//       kind: PatternKind.And,
//       patterns: [
//         {
//           kind: PatternKind.Special,
//           name: "$0"
//         },
//         {
//           kind: PatternKind.Equal,
//           value: 21
//         },
//         {
//           kind: PatternKind.Special,
//           name: "$1"
//         }
//       ]
//     }),
//     specials: {
//       $0: 7,
//       $1: 11
//     },
//     input: [21],
//     done: false
//   },
//   {
//     id: "SPECIAL03",
//     description: "special in array",
//     pattern: () => ({
//       kind: PatternKind.Array,
//       pattern: {
//         kind: PatternKind.Then,
//         patterns: [
//           {
//             kind: PatternKind.Special,
//             name: "$0"
//           },
//           {
//             kind: PatternKind.Equal,
//             value: 21
//           },
//           {
//             kind: PatternKind.Special,
//             name: "$1"
//           }
//         ]
//       }
//     }),
//     specials: {
//       $0: 7,
//       $1: 11
//     },
//     input: [[21]],
//     value: [7, 21, 11]
//   },
//   {
//     id: "SPECIAL03",
//     description: "special in object",
//     pattern: () => ({
//       kind: PatternKind.Projection,
//       pattern: {
//         kind: PatternKind.Object,
//         keys: {
//           x: {
//             kind: PatternKind.Variable,
//             name: 'x',
//             pattern: {
//               kind: PatternKind.Special,
//               name: "$0"
//             }
//           }
//         }
//       },
//       expression: {
//         kind: ExpressionKind.Native,
//         fn: ({ x }) => x
//       }
//     }),
//     specials: {
//       $0: 7,
//     },
//     input: [{ x: 11 }],
//     value: 7
//   },
//   {
//     id: "SPECIAL04",
//     description: "special in object",
//     pattern: () => ({
//       kind: PatternKind.Projection,
//       pattern: {
//         kind: PatternKind.Variable,
//         name: 'x',
//         pattern: { kind: PatternKind.Any }
//       },
//       expression: {
//         kind: ExpressionKind.SpecialReference,
//         name: "$0"
//       }
//     }),
//     specials: {
//       $0: ({ x }: { x: number }) => x + 11,
//     },
//     input: [7],
//     value: 18
//   },
//   {
//     id: "SPECIAL05",
//     description: "special in or",
//     pattern: () => ({
//       kind: PatternKind.Or,
//       patterns: [
//         { kind: PatternKind.Fail },
//         { kind: PatternKind.Special, name: "$0" }
//       ]
//     }),
//     specials: {
//       $0: 7,
//     },
//     input: [],
//     value: 7
//   },
  
//   {
//     id: "SPECIAL06",
//     description: "special in block",
//     pattern: () => ({
//       kind: PatternKind.Block,
//       rules: {
//         x: { kind: PatternKind.Rule, pattern: { kind: PatternKind.Special, name: "$0" } },
//         y: { kind: PatternKind.Rule, pattern: { kind: PatternKind.Special, name: "$1" } },
//         Main: {
//           kind: PatternKind.Rule,
//           pattern: {
//             kind: PatternKind.Projection,
//             pattern: { kind: PatternKind.Ok },
//             expression: {
//               kind: ExpressionKind.Native,
//               fn: ({ x, y }) => (console.log(x, y), x + y)
//             }
//           }
//         }
//       }
//     }),
//     specials: {
//       $0: 7,
//       $1: 11
//     },
//     input: [],
//     value: 18
//   },
// ])