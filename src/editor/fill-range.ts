// log.active
import { $, fn, fx, nu, of } from 'signal'
import { FixedArray, Point, Rect, Renderable } from 'std'
import { poolArrayGet } from 'utils'
import { Comp } from './comp.ts'
import { Editor } from './editor.ts'
import { Range } from './range.ts'

export class FillRange extends Range
  implements Comp {
  drawDirect = false
  full = false
  padBottom = 0
  colors?: {
    color: string,
    light?: string,
    dark?: string,
  }

  constructor(public ctx: Editor) { super() }

  fillRects = $(new FixedArray<$<Rect>>())

  @nu get rects() {
    const { drawDirect, full, sorted: { top, bottom }, fillRects, padBottom, ctx } = of(this)
    const { dims } = of(ctx)
    const {
      lineHeight,
      charWidth,
      // lines,
      lineTops,
      lineBaseTops,
      lineHeights,
      visibleSpan,
    } = of(dims)

    if (drawDirect) {
      const { top: vt, bottom: vb } = visibleSpan
    }
    const { line: tl, col: tc } = top
    const { line: bl, col: bc } = bottom

    $()

    const { lines } = dims
    if (!lines) return

    fillRects.count = 0
    fillRects.updated++

    if (top.equals(bottom)) {
      return fillRects
    }

    let i = 0
    let r: Rect

    const manyLines = top.line !== bottom.line
    const rightExtend = 4

    const renderExtend = 300
    const visibleTop = Math.max(0, visibleSpan.top - renderExtend)
    const visibleBottom = visibleSpan.bottom + renderExtend

    // iterate each line and produce its fill rect
    for (let line = top.line; line <= bottom.line; line++) {
      const x = line === top.y
        ? top.x * charWidth
        : 0

      const y = lineBaseTops[line]
      // const y = full
      //   ? lineTops[line] + 3
      //   : lineBaseTops[line] + 2

      const w = (line === top.line ?
        line === bottom.line
          ? (bottom.col - top.col) * charWidth
          : ((lines[line]?.length ?? 0) - top.col) * charWidth + rightExtend
        : line === bottom.line
          ? bottom.col * charWidth
          : ((lines[line]?.length ?? 0) * charWidth + rightExtend))

      const h = lineHeight
        // lineHeights[line] - (line === bottom.line ? padBottom : 0)
      // full
      //   ?
      //   : lineHeight + 0.5

      if (drawDirect) {
        if (y + h < visibleTop || y > visibleBottom) continue
      }

      r = poolArrayGet(
        fillRects.array,
        fillRects.count++,
        Rect.create
      )

      r.x = x
      r.y = y
      r.w = w + 2  // + avoids flicker rounding
      r.h = h
      r.round()
      // r.floorCeil()

      // TODO: aesthetics
      if (top.line !== bottom.line) {
        if (line === bottom.y) {
          // r.w += 2
          // r.h += 1
        }
        else if (line === top.y) {
          // r.h += 1
          // r.w += 2
          // r.x -= 2
        }
      }
    }

    return fillRects
  }
  get renderable() {
    $()
    const it = this
    return $(new FillRangeRenderable(it))
  }
}

class FillRangeRenderable {
  // offset = $(new Point, { x: .5, y: .5 })
  rect = $(new Rect)
  view = $(new Rect)
  constructor(public it: FillRange) {
    // super(it)
    // this.canDirectDraw = it.drawDirect
  }
  @fx update_rect_dims() {
    const { rect, view } = this
    const { charWidth } = of(this.it.ctx.dims)
    const { rects, colors } = of(this.it)
    const { updated, count } = rects
    $()
    view.combineRects(rects.array, rects.count).floor()
  }
  @fn draw(c: CanvasRenderingContext2D, point: Point) {
    if (!this.it.rects) return

    const {
      colors: { color, light, dark },
      rects
    } = of(this.it)

    if (!rects.count) return

    c.save()

    point.translate(c)

    c.beginPath()
    Rect.pathAround(c, rects.array, rects.count)
    c.fillStyle = color
    c.fill()
    // c.clip()

    if (dark || light) {
      // c.save()
      c.lineCap = 'square'

      c.translate(-.5, -.5)
      if (dark) {
        c.beginPath()
        Rect.pathAroundRight(c, rects.array, rects.count)
        c.strokeStyle = dark
        c.stroke()
      }

      c.translate(1, 1)
      if (light) {
        c.beginPath()
        Rect.pathAroundLeft(c, rects.array, rects.count)
        c.strokeStyle = light
        c.stroke()
      }
      // c.restore()
    }

    c.restore()
  }
}
