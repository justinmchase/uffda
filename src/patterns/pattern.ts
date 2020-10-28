import { Scope } from '../scope'
import { Match } from '../match'

export type Pattern = (scope: Scope) => Match;
