import { Signal } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { dom } from 'utils'
import { Canvas } from './comp/Canvas.tsx'
import { Sketch } from './gl/sketch.ts'
import { WasmMatrix } from './util/wasm-matrix.ts'
import { WebGL } from './webgl.ts'
import { LerpMatrix } from './util/lerp-matrix.ts'
import { Anim } from './world/anim.ts'
import { Mouse } from './world/mouse.ts'

const DEBUG = false

export type Surface = ReturnType<typeof Surface>

export function Surface(view: Rect) {
  using $ = Signal()

  const anim = Anim()
  const matrix = $(new Matrix())
  const wasmMatrix = $(new LerpMatrix())
  const mouse = Mouse(view, wasmMatrix)
  const world = { anim, view, matrix, mouse }
  const canvas = Canvas(world)
  canvas.style.imageRendering = 'pixelated'
  const webgl = WebGL(world, canvas)
  anim.ticks.add(wasmMatrix.tick)
  $.fx(() => {
    const { a, b, c, d, e, f } = wasmMatrix
    {
      const { a, b, c, d, e, f } = wasmMatrix.dest
    }
    $()
    anim.info.epoch++
  })

  const mat2d = WasmMatrix(view, wasmMatrix)
  const sketch = Sketch(webgl.GL, view, mat2d)
  webgl.add($, sketch)

  const info = $({
    isHovering: false,
  })

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
    mouse.handle(e)
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
    mouse.handle(e)
  })))

  $.fx(() => dom.on(window, 'mouseup', $.fn((e: MouseEvent): void => {
    mouse.pos.setFromEvent(e, canvas)
    mouse.isDown = false
    mouse.button = 0
    mouse.handle(e)
  })))

  $.fx(() => dom.on(window, 'wheel', $.fn((e: WheelEvent): void => {
    info.isHovering = true

    mouse.pos.setFromEvent(e, canvas)
    mouse.handle(e)

  }), { passive: true }))

  return { info, world, anim, mouse, view, matrix, wasmMatrix, canvas, webgl, sketch }
}
