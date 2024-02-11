import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { clamp, dom } from 'utils'
import { Canvas } from './comp/Canvas.tsx'
import { WebGL } from './webgl.ts'
import { World } from './world/world.ts'

const DEBUG = false //true

interface MouseTarget {
  handleMouse(): void
}

export function Surface(view: Rect) {
  using $ = Signal()

  const world = World(view)
  const { matrix, mouse } = world

  const canvas = Canvas(world)
  canvas.style.imageRendering = 'pixelated'

  const webgl = WebGL(world, canvas)

  const info = $({
    isHovering: false,
  })

  const mouseTargets = new Set<MouseTarget>()

  function handleMouse() {
    for (const t of mouseTargets) {
      t.handleMouse()
    }
  }

  $.fx(() => dom.on(window, 'resize', $.fn(() => {
    view.w = window.innerWidth
    view.h = window.innerHeight - 44
    view.pr = window.devicePixelRatio
  }), { unsafeInitial: true }))

  $.fx(() => dom.on(window, 'mousemove', $.fn((e: MouseEvent): void => {
    info.isHovering = true
    mouse.pos.setFromEvent(e)
    handleMouse()
  })))

  $.fx(() => dom.on(document, 'mouseout', $.fn((e: MouseEvent): void => {
    if (!e.relatedTarget) {
      info.isHovering = false
    }
  })))

  $.fx(() => dom.on(window, 'mousedown', $.fn((e: MouseEvent): void => {
    info.isHovering = true
    mouse.pos.setFromEvent(e)
    mouse.isDown = true
    mouse.button = e.button
    handleMouse()
  })))

  $.fx(() => dom.on(window, 'mouseup', $.fn((e: MouseEvent): void => {
    mouse.pos.setFromEvent(e)
    mouse.isDown = false
    mouse.button = 0
    handleMouse()
  })))

  $.fx(() => dom.on(window, 'wheel', $.fn((e: WheelEvent): void => {
    info.isHovering = true

    mouse.pos.setFromEvent(e)
    const { x, y } = mouse.screenPos

    const a = matrix.dest.m.a
    const delta = -e.deltaY * 0.0035
    const d = (a + (delta * a ** 0.9)) / a

    matrix.dest.m.translateSelf(x, y).scaleSelf(d, 1)
    matrix.dest.m.a = clamp(0.01, 2000, matrix.dest.m.a)
    matrix.dest.m.translateSelf(-x, -y)
    matrix.dest.sync()

    DEBUG && console.log('[matrix]', 'a:', matrix.dest.m.a)
  }), { passive: true }))

  // fx(() => {
  //   const { h } = view
  //   $()
  //   //   matrix.dest.a = 200
  //   matrix.d = matrix.dest.d = h / rows.length
  // })

  return { world, canvas, webgl, info, mouseTargets }
}
