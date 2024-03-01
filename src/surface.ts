import { Signal } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { dom } from 'utils'
import { Canvas } from './comp/Canvas.tsx'
import { Sketch } from './gl/sketch.ts'
import { state } from './state.ts'
import { LerpMatrix } from './util/geometry.ts'
import { WebGL } from './webgl.ts'
import { World } from './world/world.ts'

const DEBUG = false

export type Surface = ReturnType<typeof Surface>

export function Surface(view: Rect, intentMatrix: Matrix, viewMatrix: LerpMatrix, onresize?: () => void, alpha = false) {
  using $ = Signal()

  const info = $({
    isHovering: false,
  })

  const world = World(view, intentMatrix)
  const { anim, mouse, keyboard } = world

  const canvas = Canvas(world)
  canvas.style.imageRendering = 'pixelated'

  $.fx(() => {
    anim.ticks.add(viewMatrix.tick)
    return () => {
      anim.ticks.delete(viewMatrix.tick)
    }
  })
  $.fx(() => {
    const { a, b, c, d, e, f } = viewMatrix
    {
      const { a, b, c, d, e, f } = viewMatrix.dest
    }
    $()
    anim.info.epoch++
  })

  const webgl = WebGL(view, canvas, alpha)
  $.fx(() => {
    anim.ticks.add(webgl.draw)
    return () => {
      anim.ticks.delete(webgl.draw)
    }
  })
  const sketch = Sketch(webgl.GL, view)
  webgl.add($, sketch)

  $.fx(() => ([

    [canvas, 'contextmenu', (e: MouseEvent) => {
      e.preventDefault()
    }],

    [window, 'resize', () => {
      state.pr = window.devicePixelRatio
      onresize?.()
    }, { unsafeInitial: true }],

    [canvas, 'mouseenter', (e: MouseEvent) => {
      info.isHovering = true
    }],

    [canvas, 'mousemove', (e: MouseEvent) => {
      info.isHovering = true
    }],

    [window, 'mousemove', (e: MouseEvent) => {
      mouse.pos.setFromEvent(e, canvas)
      if (info.isHovering || mouse.isDown) mouse.handle(e)
    }],

    [document, 'mouseout', (e: MouseEvent) => {
      if (mouse.isDown) return
      if (!e.relatedTarget) {
        info.isHovering = false
        mouse.handle(e)
      }
    }],

    [canvas, 'mouseleave', (e: MouseEvent) => {
      if (mouse.isDown) return
      info.isHovering = false
      mouse.handle(e)
    }],

    [window, 'mousedown', (e: MouseEvent) => {
      mouse.pos.setFromEvent(e, canvas)
      mouse.button = e.button
      if (info.isHovering) {
        mouse.isDown = true
        mouse.handle(e)
      }
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
