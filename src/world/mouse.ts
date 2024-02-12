import { $ } from 'signal-jsx'
import { Point, Rect } from 'std'
import { LerpMatrix } from '../util/lerp-matrix.ts'

const DEBUG = false

export function Mouse(view: Rect, matrix: LerpMatrix) {
  const clipPos = $(new Point)
  const screenPos = $(new Point)

  const info = $({
    isDown: false,
    button: 0,
    pos: $(new Point),
    get clipPos() {
      const { pos } = info
      const { x, y } = pos
      const { pr, size: { w, h } } = view
      $()
      clipPos
        .setParameters(x, y)
        .div(view.size)
        .mul(2)
        .sub(1)
      clipPos.y = -clipPos.y
      DEBUG && console.log('[mouse] clipPos', clipPos.text)
      return clipPos
    },
    get screenPos() {
      const { pos } = info
      const { x, y } = pos
      const { pr } = view
      const { a, b, c, d, e, f } = matrix.dest
      $()
      screenPos
        .setParameters(x, y)
        .transformMatrixInverse(matrix.dest)
      DEBUG && console.log('[mouse] screenPos', screenPos.text)
      return screenPos
    }
  })

  return info
}
