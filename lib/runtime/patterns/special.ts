// import { Scope } from "../../scope.ts";
// import { Match } from "../../match.ts";
// // import { match } from "../match.ts";
// import { ISpecialPattern } from "./pattern.ts";

// export function special(args: ISpecialPattern, scope: Scope): Match {
//   const { name } = args;
//   const p = scope.getSpecial(name)
//   console.log('special:', name, Deno.inspect(p, { colors: true, depth: 10 }));
//   return Match.Ok(scope, scope, p);
//   // if (false) {
//   //   const s = scope.pushRef(name);
//   //   const m = match(p, s);
//   //   // console.log(`${scope.stream.path} (${Deno.inspect(scope.stream.value, { colors: true, depth: 10 })}) match (${name})`)
//   //   return m.popRef(scope);
//   // } else {
//     // todo: This needs to be in the error itself...
//     // console.log("Missing reference: ", name);
//     // return Match.Fail(scope).pushError(scope, scope);
//   // }
// }
// // 