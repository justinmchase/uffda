import { Scope } from '../scope.ts'
import { Match } from '../match.ts'

export type Pattern = (scope: Scope) => Match;
