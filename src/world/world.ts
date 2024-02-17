import { Signal } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { Anim } from './anim.ts'
import { Mouse } from './mouse.ts'

export type World = ReturnType<typeof World>

export function World(view: Rect, matrix: Matrix) {
  using $ = Signal()
  const anim = Anim()
  const mouse = Mouse(view, matrix)
  const keyboard = Keyboard()
  return { anim, view, matrix, mouse, keyboard }
}

function Keyboard() {
  using $ = Signal()

  const handle = $.fn((e: KeyboardEvent) => {
    for (const fn of keyboard.targets) {
      fn?.(e)
    }
  })

  const keyboard = $({
    handle,
    targets: new Set<(e: KeyboardEvent) => void>(),
  })

  return keyboard
}
