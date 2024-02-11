import { $ } from 'signal-jsx'
import { Point, Rect } from 'std'
import { LerpMatrix } from '../util/lerp-matrix.ts'

export function Mouse(view: Rect, matrix: LerpMatrix) {
  const clipPos = $(new Point)
  const screenPos = $(new Point)

  const info = $({
    isDown: false,
    button: 0,
    pos: $(new Point),
    get clipPos() {
      const { screenPos } = info
      const { x, y } = screenPos
      const { pr } = view
      $()
      clipPos.setParameters(x, y).mul(pr)
      return clipPos
    },
    get screenPos() {
      const { pos } = info
      const { x, y } = pos
      const { pr } = view
      const { a, d, e, f } = matrix.dest
      $()
      screenPos.setParameters(x, y).div(pr)
        .transformMatrixInverse(matrix.dest)
      return screenPos
    }
  })

  return info
}
