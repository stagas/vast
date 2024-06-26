import { $, of } from 'signal-jsx'
import { History } from './editor/history.ts'
import { checksum } from 'utils'

export type Tokenize<T extends SourceToken = SourceToken> = (
  source: { code: string }
) => (Generator<T, void, unknown> | T[])

export interface SourceToken {
  type: any // TODO Token.Type
  text: string
  line: number
  col: number
}

export function getSourceId({ code = '' }: { code?: string | undefined }) {
  return checksum(code + code + code).toString(36)
}

export class Source<T extends SourceToken = SourceToken> {
  constructor(public tokenize: Tokenize<T>) { }
  code?: string
  viewState = History.createViewState()
  epoch = 0
  get id() {
    return getSourceId(this)
  }
  get tokens(): T[] {
    const { code, tokenize } = of(this)
    $()
    this.epoch++
    return Array.from(tokenize(this as any))
  }
  get lines() {
    const { code } = of(this)
    return code.split('\n')
  }
}
