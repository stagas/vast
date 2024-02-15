import { $ } from 'signal-jsx'
import { Matrix, Point, Rect } from 'std'

const DEBUG = false

export type Mouse = ReturnType<typeof Mouse>

export function Mouse(view: Rect, matrix: Matrix) {
  const clipPos = $(new Point)
  const screenPos = $(new Point)

  const handle = $.fn((e: MouseEvent | PointerEvent | WheelEvent) => {
    for (const fn of mouse.targets) {
      fn?.(e)
    }
  })

  const mouse = $({
    matrix,
    isDown: false,
    button: 0,
    targets: new Set<(e: MouseEvent | PointerEvent | WheelEvent) => void>(),
    handle,
    pos: $(new Point),
    get clipPos() {
      const { pos } = mouse
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
      const { pos, matrix } = mouse
      const { x, y } = pos
      const { pr } = view
      const { a, b, c, d, e, f } = matrix
      $()
      screenPos
        .setParameters(x, y)
        .transformMatrixInverse(matrix)
      DEBUG && console.log('[mouse] screenPos', screenPos.text)
      return screenPos
    }
  })

  return mouse
}
