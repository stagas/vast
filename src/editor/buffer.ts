// log.active
import { $, fn, fx, nu, of } from 'signal'
import { Point, PointLike, Rect } from 'std'
import { clamp } from 'utils'
import { Editor } from './editor.ts'
import { Linecol } from './linecol.ts'
import { Source } from './source.ts'
import { findMatchingBrackets } from './util.ts'

const tempLinecol = $(new Linecol)

export class Buffer {
  constructor(public ctx: Editor, public Token: { Type: Record<string | number, string | number> }) { }

  source!: $<Source>
  @nu get code(): string | undefined { return of(this).source.code }
  set code(v: string) { of(this).source.code = v }
  @nu get tokens() { return of(this).source.tokens }
  @nu get lines() { return of(this).source.lines }

  linecol = $(new Linecol)
  linecolClamped = $(new Linecol)

  line = this.linecol.$.line
  col = this.linecol.$.col // actual col
  coli = 0 // col intent

  bracketsPair = {
    open: $(new Linecol),
    close: $(new Linecol)
  }
  hasBrackets = false

  fillRects: Rect[] = []
  dirtyRect = $(new Rect)

  @fx update_editor_viewState() {
    const { ctx, source } = of(this)
    const { viewState } = of(source)
    $()
    ctx.history.viewState = viewState
  }
  @fx clamp_lineCol() {
    const { lines, line, coli } = of(this)
    $()
    this.line = Math.min(line, lines.length - 1)
    this.col = Math.min(coli, lines[this.line]?.length ?? 0)
  }
  @fx trim_line_endings() {
    const { lines, line } = of(this)
    for (let i = 0; i < lines.length; i++) {
      if (i === line) continue
      lines[i] = lines[i].trimEnd()
    }
    // $.code = lines.join('\n')
  }
  getIndexFromLineCol({ line, col }: Linecol): number {
    const { code } = of(this)
    const lines = code
      .split('\n')
      .slice(0, line)
    return col
      + lines.join('\n').length
      // add the missing \n to the length when line >0
      + (lines.length ? 1 : 0)
  }
  @fn getLineColFromIndex(index: number, tp: Linecol = tempLinecol): Linecol {
    const { code } = of(this)
    const slice = code.slice(0, index)
    const lines = slice.split('\n')
    const line = lines.length - 1
    const col = lines.at(-1)?.length ?? 0
    tp.line = line
    tp.col = col
    return tp
  }
  @fn getLineColFromPoint(
    p: Point, clampPos = true, tp?: Linecol): Linecol {
    const { lines, ctx } = of(this)
    const { dims } = of(ctx)
    const { lineTops, scroll, view, charWidth } = of(dims)

    const py = p.y - scroll.y //- view.y
    const px = p.x - scroll.x //- view.x

    let y = 0
    for (; y < lineTops.length; y++) {
      if (py <= lineTops[y]!) break
    }
    --y

    let x = Math.max(0, Math.round((px - 1) / charWidth))

    if (clampPos) {
      y = clamp(0, lines.length - 1, y)
      x = Math.min(lines[y]?.length ?? 0, x)
    }

    if (tp) {
      tp.x = x
      tp.y = y
      return tp
    }
    tempLinecol.x = x
    tempLinecol.y = y
    return tempLinecol
  }
  @fn getPointFromLineCol(
    { line, col }: Linecol,
    tp: PointLike): PointLike {
    const { dims } = of(this.ctx)
    const { lineBaseTops, charWidth } = of(dims)
    tp.x = charWidth * col
    tp.y = lineBaseTops[line]
    return tp
  }
  @fn getPointFromIndex(index: number, tp: PointLike) {
    return this.getPointFromLineCol(
      this.getLineColFromIndex(index),
      tp
    )
  }
  @fx update_brackets() {
    const { code, linecol: lineCol, line, col, bracketsPair: { open, close } } = of(this)
    $()
    const index = this.getIndexFromLineCol(lineCol)
    const brackets = findMatchingBrackets(code, index)

    if (brackets) {
      this.hasBrackets = true
      this.getLineColFromIndex(brackets[0], open)
      this.getLineColFromIndex(brackets[1], close)
    }
    else {
      this.hasBrackets = false
    }
  }
}
