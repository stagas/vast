// log.active
import { $, fn, fx, of, prop, when } from 'signal'
import { Point } from 'std'
import { FillRange } from './fill-range.ts'
import { Linecol } from './linecol.ts'
import { BRACKET, Close, TOKEN, closers, findMatchingBrackets, parseWords } from './util.ts'
import { debounce } from 'utils'

const tempPoint = $(new Point)

export class Selection extends FillRange {
  drawDirect = true

  colors = prop(() => ({
    color: '#40b',
    // color: this.ctx.skin.colors.bgBright2
  }))

  selectionText = ''

  _deleteKeyEvent = new KeyboardEvent('keydown', { key: 'Delete' })

  get hasSelection() {
    return !this.start.equals(this.end)
  }
  @fn getSelectionIndexes() {
    const { buffer } = of(this.ctx)
    const { top, bottom } = this.sorted
    const a = buffer.getIndexFromLineCol(top)
    const b = buffer.getIndexFromLineCol(bottom)
    tempPoint.left = a
    tempPoint.right = b
    return tempPoint
  }
  get deleteSelection() {
    const { history, buffer, keyboard } = of(this.ctx)
    return history.historic(() => {
      const { code } = buffer
      if (!code) return ''

      const selection = this
      if (selection.start.equals(selection.end)) return ''

      const { top, bottom } = selection.sorted
      const a = buffer.getIndexFromLineCol(top)
      const b = buffer.getIndexFromLineCol(bottom)
      const removing = code.slice(a, b)
      const charRight = code[b]!

      buffer.code = code.slice(0, a) + code.slice(b)
      buffer.line = top.y
      buffer.coli = buffer.col = top.x

      const res = { x: buffer.coli, y: buffer.line }
      selection.start.set(res)
      selection.end.set(res)

      // KEEP: needed for animation to work
      // breaks selection and typing a letter
      // $.flush()

      if (closers.has(charRight) && removing === Close[charRight]) {
        keyboard.handleKey(this._deleteKeyEvent)
      }
      return removing
    })
  }
  @fn resetTo(p: Point) {
    this.start.set(p)
    this.end.set(p)
  }
  @fn selectLine(line: number) {
    const selection = this
    const { ctx } = of(this)
    const { buffer } = of(ctx)
    const { lines } = of(buffer)

    selection.start.set({ x: 0, y: line })
    selection.end.set({ x: lines[line].length, y: line })
    return true
  }
  @fn selectMatchingBrackets(p: Linecol, exclusive?: boolean) {
    const selection = this
    const { ctx } = of(this)
    const { buffer } = of(ctx)
    const { code } = of(buffer)

    const index = buffer.getIndexFromLineCol(p)
    const match = findMatchingBrackets(code, index)
    if (match) {
      const exn = Number(exclusive ?? 0)
      let start = match[0] + exn
      let end = match[1] - exn + 1
      // swap direction depending on which side we are closest.
      if (Math.abs(end - index) > Math.abs(start - index)) {
        [start, end] = [end, start]
      }
      buffer.getLineColFromIndex(start, selection.start)
      buffer.getLineColFromIndex(end, selection.end)
      return true
    }
    return false
  }
  @fn selectWordBoundary(p: Linecol, expand?: boolean) {
    const selection = this
    const { ctx } = of(this)
    const { sorted: { forward } } = selection.sorted
    const { buffer } = of(ctx)
    const { code, lines } = of(buffer)
    const { line, col } = p
    const words = parseWords(TOKEN, lines[line])
    for (let i = 0, word: any, next: any; i < words.length; i++) {
      word = words[i]
      next = i < words.length - 1 ? words[i + 1] : { index: Infinity }
      if (col >= word.index && col < next.index) {
        const start = { x: word.index, y: line }
        const end = { x: word.index + word[0].length, y: line }
        if (expand) {
          selection.end.set(forward ? end : start)
        }
        else {
          selection.start.set(start)
          selection.end.set(end)
        }
        // We exclude brackets from being selected as words, so
        // that we fall back to a matching brackets selection in mouse.
        if (word[0].length === 1 && BRACKET.test(word)) return false
        return Boolean(word[0].trim().length)
      }
    }
    return false
  }
  @fx shiftKeyPressedExtendsSelection() {
    const selection = this
    const { ctx } = of(this)
    const { buffer, text, keyboard, misc } = of(ctx)
    const { line, col } = of(buffer)
    const { isFocused } = when(misc)
    const { shift } = when(keyboard)
    $()
    // TODO: only when isFocused
    selection.end.set({ x: col, y: line })
  }
  @fn updateTextareaText = () => {
    const { ctx, selectionText } = of(this)
    const { keyboard } = of(ctx)
    keyboard.textarea.value = selectionText
    keyboard.textarea.select()
  }
  updateTextareaTextDebounced = debounce(250, this.updateTextareaText)
  @fx update_text() {
    const selection = this
    const { ctx } = of(this)
    const { start: { xy: sxy }, end: { xy: exy } } = selection
    const { buffer } = of(ctx)
    const { source, code } = of(buffer)
    $()
    const { top, bottom } = selection.sorted
    const a = buffer.getIndexFromLineCol(top)
    const b = buffer.getIndexFromLineCol(bottom)
    this.selectionText = code.slice(a, b)
    this.updateTextareaTextDebounced()
  }
}
