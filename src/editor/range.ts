import { $ } from 'signal'
import { Line } from 'std'
import { Linecol } from './linecol.ts'

export class Range extends Line {
  p1 = $(new Linecol)
  p2 = $(new Linecol)
  forward?: boolean
  _sorted?: Range
  get sorted(): Range {
    const { start, end } = this
    // Line & forward
    let top: $<Linecol>
    let bottom: $<Linecol>
    let forward = false

    if (start.y === end.y) {
      if (start.x < end.x) {
        top = start
        bottom = end
        forward = true
      }
      else {
        top = end
        bottom = start
      }
    }
    else if (start.y < end.y) {
      top = start
      bottom = end
      forward = true
    }
    else {
      top = end
      bottom = start
    }
    $()
    this._sorted ??= $(new Range)
    this._sorted.top = top
    this._sorted.bottom = bottom
    this._sorted.forward = forward
    return this._sorted
  }
}
