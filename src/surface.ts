import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { dom } from 'utils'
import { Canvas } from './comp/Canvas.tsx'
import { Sketch } from './gl/sketch.ts'
import { state } from './state.ts'
import { WasmMatrix } from './util/wasm-matrix.ts'
import { WebGL } from './webgl.ts'
import { World } from './world/world.ts'

const DEBUG = false

export type Surface = ReturnType<typeof Surface>

export function Surface(view: Rect) {
  using $ = Signal()

  const info = $({
    isHovering: false,
  })

  const world = World(view)
  const { anim, matrix: intentMatrix, mouse, keyboard } = world

  const canvas = Canvas(world)
  canvas.style.imageRendering = 'pixelated'

  const viewMatrix = state.viewMatrix
  const mat2d = WasmMatrix(view, viewMatrix)
  anim.ticks.add(viewMatrix.tick)
  $.fx(() => {
    const { a, b, c, d, e, f } = viewMatrix
    {
      const { a, b, c, d, e, f } = viewMatrix.dest
    }
    $()
    anim.info.epoch++
  })

  const webgl = WebGL(world, canvas)
  const sketch = Sketch(webgl.GL, view, mat2d)
  webgl.add($, sketch)

  $.fx(() => ([

    [canvas, 'contextmenu', (e: MouseEvent) => {
      e.preventDefault()
    }],

    [window, 'resize', () => {
      view.w = window.innerWidth
      view.h = window.innerHeight - 44
      view.pr = window.devicePixelRatio
    }, { unsafeInitial: true }],

    [canvas, 'mousemove', (e: MouseEvent) => {
      info.isHovering = true
    }],

    [window, 'mousemove', (e: MouseEvent) => {
      // info.isHovering = true
      mouse.pos.setFromEvent(e, canvas)
      if (info.isHovering) mouse.handle(e)
    }],

    [document, 'mouseout', (e: MouseEvent) => {
      if (!e.relatedTarget) {
        info.isHovering = false
        mouse.handle(e)
      }
    }],

    [canvas, 'mouseleave', (e: MouseEvent) => {
      info.isHovering = false
      mouse.handle(e)
    }],

    [window, 'mousedown', (e: MouseEvent) => {
      mouse.pos.setFromEvent(e, canvas)
      mouse.isDown = true
      mouse.button = e.button
      if (info.isHovering) mouse.handle(e)
    }],

    [window, 'mouseup', (e: MouseEvent) => {
      mouse.pos.setFromEvent(e, canvas)
      mouse.isDown = false
      mouse.button = 0
      if (info.isHovering) mouse.handle(e)
    }],

    [window, 'wheel', (e: WheelEvent) => {
      mouse.pos.setFromEvent(e, canvas)
      if (info.isHovering) mouse.handle(e)
    }, { passive: true }],

    [window, 'keydown', (e: KeyboardEvent) => {
      keyboard.handle(e)
    }],

  ]).map(([el, name, handler, opts]: any) =>
    dom.on(el, name, $.fn(handler), opts)
  ))

  return { info, world, anim, mouse, keyboard, view, intentMatrix, viewMatrix, canvas, webgl, sketch }
}
