export const MorseLang = `
# MorseLang is authored in Uffda and compiled through the normal runtime path.
# 123 Comments are unconditional, even when their text starts with a number.
export rule Morse =
  x:Symbol+           # Capture one or more decoded symbols in source order.
  end                 # Reject a valid prefix followed by an unknown Morse sequence.
  -> (join x "");     # Comments may trail a complete declaration.

# A leading pipe keeps a long alternation aligned and easy to extend.
rule Symbol =
	| A | B | C | D | E | F | G | H | I | J | K | L | M
	| N | O | P | Q | R | S | T | U | V | W | X | Y | Z
	| Digit0 | Digit1 | Digit2 | Digit3 | Digit4
	| Digit5 | Digit6 | Digit7 | Digit8 | Digit9
	| Period | Comma | QuestionMark | Apostrophe | ExclamationMark
	| Slash | OpenParenthesis | CloseParenthesis | Ampersand | Colon
	| Semicolon | Equals | Plus | Hyphen | Underscore | QuotationMark
	| DollarSign | AtSign;

# Letters use a trailing slash so prefix-related Morse codes stay unambiguous.
rule A = "." "-" "/" -> "A";
rule B = "-" "." "." "." "/" -> "B";
rule C = "-" "." "-" "." "/" -> "C";
rule D = "-" "." "." "/" -> "D";
rule E = "." "/" -> "E";
rule F = "." "." "-" "." "/" -> "F";
rule G = "-" "-" "." "/" -> "G";
rule H = "." "." "." "." "/" -> "H";
rule I = "." "." "/" -> "I";
rule J = "." "-" "-" "-" "/" -> "J";
rule K = "-" "." "-" "/" -> "K";
rule L = "." "-" "." "." "/" -> "L";
rule M = "-" "-" "/" -> "M";
rule N = "-" "." "/" -> "N";
rule O = "-" "-" "-" "/" -> "O";
rule P = "." "-" "-" "." "/" -> "P";
rule Q = "-" "-" "." "-" "/" -> "Q";
rule R = "." "-" "." "/" -> "R";
rule S = "." "." "." "/" -> "S";
rule T = "-" "/" -> "T";
rule U = "." "." "-" "/" -> "U";
rule V = "." "." "." "-" "/" -> "V";
rule W = "." "-" "-" "/" -> "W";
rule X = "-" "." "." "-" "/" -> "X";
rule Y = "-" "." "-" "-" "/" -> "Y";
rule Z = "-" "-" "." "." "/" -> "Z";

# Digits follow the same slash-terminated representation.
rule Digit0 = "-" "-" "-" "-" "-" "/" -> "0";
rule Digit1 = "." "-" "-" "-" "-" "/" -> "1";
rule Digit2 = "." "." "-" "-" "-" "/" -> "2";
rule Digit3 = "." "." "." "-" "-" "/" -> "3";
rule Digit4 = "." "." "." "." "-" "/" -> "4";
rule Digit5 = "." "." "." "." "." "/" -> "5";
rule Digit6 = "-" "." "." "." "." "/" -> "6";
rule Digit7 = "-" "-" "." "." "." "/" -> "7";
rule Digit8 = "-" "-" "-" "." "." "/" -> "8";
rule Digit9 = "-" "-" "-" "-" "." "/" -> "9";

# Punctuation comments may contain !@* and "quoted # text" without semantics.
rule Period = "." "-" "." "-" "." "-" "/" -> ".";
rule Comma = "-" "-" "." "." "-" "-" "/" -> ",";
rule QuestionMark = "." "." "-" "-" "." "." "/" -> "?";
rule Apostrophe = "." "-" "-" "-" "-" "." "/" -> "'";
rule ExclamationMark = "-" "." "-" "." "-" "-" "/" -> "!";
rule Slash = "-" "." "." "-" "." "/" -> "/";
rule OpenParenthesis = "-" "." "-" "-" "." "/" -> "(";
rule CloseParenthesis = "-" "." "-" "-" "." "-" "/" -> ")";
rule Ampersand = "." "-" "." "." "." "/" -> "&";
rule Colon = "-" "-" "-" "." "." "." "/" -> ":";
rule Semicolon = "-" "." "-" "." "-" "." "/" -> ";";
rule Equals = "-" "." "." "." "-" "/" -> "=";
rule Plus = "." "-" "." "-" "." "/" -> "+";
rule Hyphen = "-" "." "." "." "." "-" "/" -> "-";
rule Underscore = "." "." "-" "-" "." "-" "/" -> "_";
rule QuotationMark = "." "-" "." "." "-" "." "/" -> "\\\"";
rule DollarSign = "." "." "." "-" "." "." "-" "/" -> "$";
rule AtSign = "." "-" "-" "." "-" "." "/" -> "@";
`;
