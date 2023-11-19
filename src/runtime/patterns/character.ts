import { Match } from "../../match.ts";
import { Scope } from "../../mod.ts";
import { CharacterClass, ICharacterPattern } from "./pattern.ts";

export function character(args: ICharacterPattern, scope: Scope): Match {
  const { characterClass } = args;
  const pattern = characterClassToRegexp(characterClass);
  if (!scope.stream.done) {
    const next = scope.stream.next();
    if (scope.options.trace) {
      console.log(`* ${pattern} : <${next.value}>`);
    }
    if (typeof next.value === "string" && pattern.test(next.value)) {
      return Match.Ok(scope, scope.withInput(next), next.value);
    }
  }
  return Match.Fail(scope);
}

function characterClassToRegexp(characterClass: CharacterClass) {
  switch (characterClass) {
    case CharacterClass.Any:
      return /\p{Any}/u;
    case CharacterClass.Assigned:
      return /\p{Assigned}/u;
    case CharacterClass.Ascii:
      return /\p{ASCII}/u;
    case CharacterClass.Letter:
    case CharacterClass.UppercaseLetter:
    case CharacterClass.LowercaseLetter:
    case CharacterClass.TitlecaseLetter:
    case CharacterClass.ModifierLetter:
    case CharacterClass.OtherLetter:
    case CharacterClass.Mark:
    case CharacterClass.NonSpacingMark:
    case CharacterClass.SpacingCombiningMark:
    case CharacterClass.EnclosingMark:
    case CharacterClass.Number:
    case CharacterClass.DecimalDigitNumber:
    case CharacterClass.LetterNumber:
    case CharacterClass.OtherNumber:
    case CharacterClass.Symbol:
    case CharacterClass.MathSymbol:
    case CharacterClass.CurrencySymbol:
    case CharacterClass.ModifierSymbol:
    case CharacterClass.OtherSymbol:
    case CharacterClass.Punctuation:
    case CharacterClass.ConnectorPunctuation:
    case CharacterClass.DashPunctuation:
    case CharacterClass.OpenPunctuation:
    case CharacterClass.ClosePunctuation:
    case CharacterClass.InitualPunctuation:
    case CharacterClass.FinalPunctuation:
    case CharacterClass.OtherPunctuation:
    case CharacterClass.Separator:
    case CharacterClass.SpaceSeparator:
    case CharacterClass.LineSeparator:
    case CharacterClass.ParagraphSeparator:
    case CharacterClass.Other:
    case CharacterClass.Control:
    case CharacterClass.Format:
    case CharacterClass.Surrogate:
    case CharacterClass.PrivateUse:
    case CharacterClass.Unassigned:
      return new RegExp(`\\p{${characterClass}}`, "u");
    default:
      // todo: throw a better error
      throw new Error(`unknown character class ${characterClass}`);
  }
}
