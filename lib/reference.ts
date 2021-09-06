import { Path } from './path.ts';

export class Reference {
  constructor(
    public readonly name: string,
    public readonly path: Path,
  ) {}
}
