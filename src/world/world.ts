import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { state } from '../state.ts'
import { Anim } from './anim.ts'
import { Mouse } from './mouse.ts'

export type World = ReturnType<typeof World>

export function World(view: Rect) {
  using $ = Signal()

  const { matrix } = state
  const anim = Anim()
  const mouse = Mouse(view, matrix)

  anim.ticks.add(matrix.tick)
  $.fx(() => {
    const { a, b, c, d, e, f } = matrix
    {
      const { a, b, c, d, e, f } = matrix.dest
    }
    $()
    anim.info.epoch++
  })

  return { anim, view, matrix, mouse }
}
