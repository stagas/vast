import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { clamp, dom } from 'utils'
import { Canvas } from './comp/Canvas.tsx'
import { Sketch } from './gl/sketch.ts'
import { WasmMatrix } from './util/wasm-matrix.ts'
import { WebGL } from './webgl.ts'
import { World } from './world/world.ts'

const DEBUG = false

interface MouseTarget {
  handleMouse(): void
}

export type Surface = ReturnType<typeof Surface>

export function Surface(view: Rect) {
  using $ = Signal()

  const world = World(view)
  const { matrix, mouse } = world

  const canvas = Canvas(world)
  canvas.style.imageRendering = 'pixelated'

  const webgl = WebGL(world, canvas)
  const mat2d = WasmMatrix(view, matrix)
  const sketch = Sketch(webgl.GL, view, mat2d)
  webgl.add($, sketch)

  const info = $({
    isHovering: false,
  })

  const mouseTargets = new Set<MouseTarget>()

  function handleMouse() {
    for (const t of mouseTargets) {
      t.handleMouse()
    }
  }

  $.fx(() => dom.on(canvas, 'contextmenu', $.fn((e: MouseEvent): void => {
    e.preventDefault()
  })))

  $.fx(() => dom.on(window, 'resize', $.fn(() => {
    view.w = window.innerWidth
    view.h = window.innerHeight - 44
    matrix.pr =
      view.pr = window.devicePixelRatio
  }), { unsafeInitial: true }))

  $.fx(() => dom.on(window, 'mousemove', $.fn((e: MouseEvent): void => {
    info.isHovering = true
    mouse.pos.setFromEvent(e, canvas)
    handleMouse()
  })))

  $.fx(() => dom.on(document, 'mouseout', $.fn((e: MouseEvent): void => {
    if (!e.relatedTarget) {
      info.isHovering = false
    }
  })))

  $.fx(() => dom.on(window, 'mousedown', $.fn((e: MouseEvent): void => {
    info.isHovering = true
    mouse.pos.setFromEvent(e, canvas)
    mouse.isDown = true
    mouse.button = e.button
    handleMouse()
  })))

  $.fx(() => dom.on(window, 'mouseup', $.fn((e: MouseEvent): void => {
    mouse.pos.setFromEvent(e, canvas)
    mouse.isDown = false
    mouse.button = 0
    handleMouse()
  })))

  function handleWheelScaleY(e: WheelEvent) {
    const { x, y } = mouse.screenPos

    const d = matrix.dest.m.d
    const delta = -e.deltaY * 0.0035
    const delta_d = (d + (delta * d ** 0.9)) / d

    DEBUG && console.log('[surface] wheelDelta d:', d, delta, delta_d)

    matrix.dest.m.translateSelf(x, y).scaleSelf(1, delta_d)
    matrix.dest.m.d = clamp(0.01, 2000, matrix.dest.m.d)
    matrix.dest.m.translateSelf(-x, -y)
    matrix.dest.sync()
  }

  function handleWheelScaleX(e: WheelEvent) {
    const { x, y } = mouse.screenPos

    const a = matrix.dest.m.a
    const delta = -e.deltaY * 0.0035
    const delta_a = (a + (delta * a ** 0.9)) / a

    DEBUG && console.log('[surface] wheelDelta a:', a, delta, delta_a)

    matrix.dest.m.translateSelf(x, y).scaleSelf(delta_a, 1)
    matrix.dest.m.a = clamp(0.01, 2000, matrix.dest.m.a)
    matrix.dest.m.translateSelf(-x, -y)
    matrix.dest.sync()

    DEBUG && console.log('[surface] matrix.dest.a:', matrix.dest.m.a)
  }

  $.fx(() => dom.on(window, 'wheel', $.fn((e: WheelEvent): void => {
    info.isHovering = true
    mouse.pos.setFromEvent(e, canvas)
    handleWheelScaleX(e)
  }), { passive: true }))

  return { info, world, view, matrix, canvas, webgl, sketch, mouseTargets }
}
