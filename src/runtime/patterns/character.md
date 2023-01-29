# Characters

The character pattern matches string characters against well-defined unicode
character classes.

The syntax will be `\c{Abb.}` such as `\cL`, `\cA`

https://unicode.org/reports/tr18/#General_Category_Property

| Abb. | Long form              | Abb. | Long form             | Abb. | Long form           |
| ---- | ---------------------- | ---- | --------------------- | ---- | ------------------- |
| L    | Letter                 | S    | Symbol                | Z    | Separator           |
| Lu   | Uppercase Letter       | Sm   | Math Symbol           | Zs   | Space Separator     |
| Ll   | Lowercase Letter       | Sc   | Currency Symbol       | Zl   | Line Separator      |
| Lt   | Titlecase Letter       | Sk   | Modifier Symbol       | Zp   | Paragraph Separator |
| Lm   | Modifier Letter        | So   | Other Symbol          | C    | Other               |
| Lo   | Other Letter           | P    | Punctuation           | Cc   | Control             |
| M    | Mark                   | Pc   | Connector Punctuation | Cf   | Format              |
| Mn   | Non-Spacing Mark       | Pd   | Dash Punctuation      | Cs   | Surrogate           |
| Mc   | Spacing Combining Mark | Ps   | Open Punctuation      | Co   | Private Use         |
| Me   | Enclosing Mark         | Pe   | Close Punctuation     | Cn   | Unassigned          |
| N    | Number                 | Pi   | Initial Punctuation   | A    | Any*                |
| Nd   | Decimal Digit Number   | Pf   | Final Punctuation     | As   | Assigned*           |
| Nl   | Letter Number          | Po   | Other Punctuation     | Ac   | ASCII*              |
| No   | Other Number           |      |                       |      |                     |

> \* this entry is non-abbreviated officially but is abbreviated in uffda
