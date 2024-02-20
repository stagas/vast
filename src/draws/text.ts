import { Signal } from 'signal-jsx'
import { state } from '../state.ts'
import { Grid } from './grid.ts'
import { Surface } from '../surface.ts'
import { Point, Rect } from 'std'
import { Canvas } from '../comp/Canvas.tsx'
import { Minimap } from '../draws/minimap.ts'
import { CodeDraw } from '../draws/code.ts'
import { CODE_WIDTH } from '../constants.ts'
import { dom } from 'utils'

const DEBUG = true

export function TextDraw(surface: Surface, grid: Grid, view: Rect) {
  using $ = Signal()

  const textView = $(new Rect, { pr: state.$.pr }).set(view)
  textView.w -= CODE_WIDTH
  textView.x += CODE_WIDTH

  const hitArea = $(new Rect)

  const mousePos = $(new Point)
  $.fx(() => dom.on(window, 'mousemove', (e) => {
    mousePos.x = ((e.pageX - textView.x_pr) * state.pr) // + textView.x // * state.pr// state.pr
    mousePos.y = (e.pageY - 44) * state.pr
    if (mousePos.withinRect(hitArea)) {
      console.log('yes')
    }
    else {
      // console.log('no')
    }
  }))
  // textView.h -= 2
  const canvas = Canvas({ view: textView })
  canvas.style.position = 'absolute'
  canvas.style.pointerEvents = 'none'
  canvas.style.imageRendering = 'pixelated'
  canvas.style.left = CODE_WIDTH + 'px'
  canvas.style.top = '46px'

  const c = canvas.getContext('2d', { alpha: true })!
  c.imageSmoothingEnabled = false
  c.save()
  surface.anim.ticks.add(() => {
    c.restore()

    c.save()
    c.scale(state.pr, state.pr)
    c.translate(-textView.x, 0)
    textView.clear(c)
    c.restore()

    c.save()
    if (!grid || !surface) return
    if (!grid?.info.focusedBox) return
    const m = surface.viewMatrix
    c.translate(-textView.x * state.pr, 0)
    c.beginPath()
    const data = grid.info.focusedBox!
    const x = data.x * m.a * 2 + m.e * 2 //+ 40
    const y = data.y * m.d * 2 + m.f * 2
    // const w = (data.w * m.a * 2)
    const h = (data.h * m.d * 2)
    const bh = 45
    c.font = '32px Mono'
    const text = '32 16 8 4 2 1  shuffle  quantize  dup  sample:4b  share'
    const metrics = c.measureText(text)
    // if (data.y === 0) {
    //   c.rect(x, y + h, metrics.width + 12, bh)
    // }
    // else {
    const padX = 50
    hitArea.x = x
    hitArea.y = y - bh
    hitArea.w = metrics.width + padX
    hitArea.h = bh
    hitArea.path(c)
    // c.rect(x, y - bh, metrics.width + padX, bh)
    // }
    c.lineWidth = state.pr * 2
    c.fillStyle = state.colors['base-100']
    c.fill()
    c.fillStyle = state.colors['secondary']
    c.textBaseline = 'middle'
    c.textAlign = 'left'
    // if (data.y === 0) {
    //   c.fillText(text, x + 5, y + h + bh / 2 + 3.5)
    // }
    // else {

    c.fillText(text, x + padX / 2, y - bh / 2 + 3.5)
    // }
    c.restore()
    c.save()
  })

  return { canvas, hitArea }
}
