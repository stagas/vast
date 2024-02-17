import { alias } from 'signal'
import { Point } from 'std'

export class Linecol extends Point {
  line = alias(this, 'y')
  col = alias(this, 'x')
  get lineCol() {
    return this
  }
  get lineColText() {
    return `${this.line}:${this.col}`
  }
}
