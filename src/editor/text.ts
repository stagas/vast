import { $, fn, of } from 'signal'
import { Point } from 'std'
import { MouseButtons, debounce, dom, match, prevent } from 'utils'
import { Comp } from './comp.ts'
import { Keyboard } from './keyboard.ts'
import { Linecol } from './linecol.ts'
import { PointerEventType } from './pointer.ts'
import { Scroll } from './scroll.ts'
import { Close, NONSPACE, Open, SPACE, WORD, closers, escapeRegExp, findMatchingBrackets, lineBegin, openers, parseWords } from './util.ts'

// FOLD: 4

const DEBUG = false

interface Keypress {
  key?: Keyboard.Key | undefined
  char?: string | undefined
  special?: (
    Keyboard.Key & {
      kind: Keyboard.KeyKind.Special
    })['value'] | ''
  alt?: boolean | undefined
  ctrl?: boolean | undefined
  shift?: boolean | undefined
  time?: number
  real?: KeyboardEvent
}

const ignoredKeys = 'cvxJr=+-tn'
const handledKeys = 'zyvxc=+-tnb'

export class Text extends Comp {
  padding = $(new Point)
  offset = $(new Point)
  linecol = $(new Linecol)
  mousePos = $(new Point)
  isDown = false
  downCount = 0
  keypress?: Keypress
  rescroll = 0

  debounceClearDownCount = debounce(200, () => {
    this.downCount = 0
  })

  @fn onMouseEvent(kind: PointerEventType) {
    const it = this
    const { linecol, mousePos, padding, offset } = it
    const { view, buffer, dims, misc, keyboard, scroll, selection, history } = it.ctx
    const mouse = it.ctx.pointer
    if (!dims.charWidth) return
    if (!buffer.lines) return

    const { Down, Up, Wheel, Move } = PointerEventType

    mousePos.set(mouse.pos).sub(view.pos).sub(padding).sub(offset)
    // mousePos.set(mouse.pos).sub({ x: 60, y: 39 })
    // console.log(mousePos.text, view.pos.text)
    if (kind !== Wheel) {
      buffer.getLineColFromPoint(
        mousePos,
        true,
        linecol
      )
    }

    // console.log(mousePos.text)

    // log('linecol', linecol.text)
    misc.isTyping = false

    switch (kind) {
      // case Click:
      case Up:
        this.isDown = false
        keyboard.textarea.focus()
        return true

      case Wheel:
        scroll.targetScroll.mulSub(mouse.wheel, 0.35)
        scroll.animSettings = Scroll.AnimSettings.Medium
        return false

      case Move:
        if (this.isDown && (mouse.buttons & MouseButtons.Left)) {
          selection.end.set(linecol)
          buffer.linecol.set(linecol)
          buffer.coli = linecol.col
        }
        return true

      case Down:
        if (!(mouse.buttons & MouseButtons.Left)) return

        prevent(of(mouse).real)

        history.saveHistory()

        buffer.linecol.set(linecol)
        buffer.coli = linecol.col

        this.isDown = true
        misc.isFocused = true

        this.debounceClearDownCount()

        switch (++this.downCount) {
          case 1:
            if (mouse.shift) {
              selection.end.set(linecol)
            }
            else {
              selection.resetTo(linecol)
            }
            break

          case 2:
            if (selection.selectWordBoundary(linecol, mouse.shift)) {
              this.downCount = 2
              break
            }
          case 3:
            if (selection.selectMatchingBrackets(linecol)) {
              this.downCount = 3
              break
            }
          case 4:
            selection.selectLine(linecol.line)
            break
        }

        history.saveHistory()

        return true
    }
  }

  @fn onKeyboardEvent(kind: Keyboard.EventKind): Keyboard.Result {
    const it = this
    const { misc, clipboard, selection, history, keyboard } = it.ctx
    const { Down, Up, Copy, Cut, Paste } = Keyboard.EventKind
    const { Char, Special } = Keyboard.KeyKind

    const { key, char, special, alt, ctrl, shift } = keyboard

    this.rescroll++
    // history.saveHistoryDebounced()

    return match('Key', { kind }, [
      [[{ kind: Down }], (): Keyboard.Result => {
        if (ctrl) {
          if (special === 'Control'
            || (char != null
              && char.length
              && ignoredKeys.includes(char))
          ) {
            return
          }
        }
        misc.isTyping = true
        return this.handleKey(keyboard)
      }],

      [[{ kind: Copy }], () => {
        return selection.selectionText
      }],

      [[{ kind: Cut }], () => {
        return selection.deleteSelection()
      }],

      [[{ kind: Paste }], () => {
        clipboard.handlePaste(keyboard.clip!)
      }],
    ], DEBUG ? ((category, matcher, result) => {
      console.log(
        category,
        Keyboard.EventKind[matcher!.kind],
        { char, special, ctrl, shift, alt },
        result
      )
    }) : () => { })
  }

  specialKeys: any = {
    'Enter': '\n',
    'Tab': ' ',
    'Space': ' ',
  }

  @fn handleKey(keypress: Keypress) {
    const it = this
    const { ctx } = it
    const { misc, clipboard, selection, history, buffer: b, dims, scroll } = ctx

    // TODO: use these
    const { Down, Up, Copy, Cut, Paste } = Keyboard.EventKind
    const { Char, Special } = Keyboard.KeyKind

    const { specialKeys } = this
    const { view, lineHeight } = of(dims)
    const { hasSelection } = of(selection)

    let { code, lines } = of(b)
    let { key, char = '', special = '', alt, ctrl, shift } = keypress

    if (!(b.line in lines)) {
      return
      // throw new Error('Invalid line: ' + b.line)
    }

    let text = lines[b.line]
    const currentChar = text[b.col]
    const maxLine = lines.length - 1
    const page = Math.floor(view.h / lineHeight)

    let x: number
    let dy: number
    let targetLine: number

    // log('handleKey', { char, special })

    char = special in specialKeys
      ? specialKeys[special]
      : char.length === 1 && char.match(/[\S\s]/)
        ? char
        : ''

    return match('Keypress', keypress, [
      [[{ special: 'Control' }], (): Keyboard.Result => { }],

      [[{ special: 'Shift' }], () => {
        if (!hasSelection) {
          selection.end.set(selection.start.set({ x: b.col, y: b.line }))
        }
      }],

      [[{ special: 'ArrowDown' }], () => {
        if (b.line === maxLine) return

        // move line(s)
        if (alt || (shift && ctrl)) {
          history.saveHistoryDebounced()
          if (!hasSelection) {
            const line = lines.splice(b.line, 1)[0]!
            lines.splice(++b.line, 0, line)
            b.code = lines.join('\n')
            $.flush()
            selection.start.set(selection.end)
            return
          }
          else {
            const { top, bottom } = selection.sorted
            if (bottom.y === maxLine) return

            const slice = lines.splice(top.y, bottom.y - top.y + 1)
            lines.splice(++top.y, 0, ...slice)
            ++bottom.y
            b.code = lines.join('\n')
          }
        }

        ++b.line

        // return true
      }],

      [[{ special: 'ArrowUp' }], (): Keyboard.Result => {
        if (b.line === 0) return

        // move line(s)
        if (alt || (shift && ctrl)) {
          history.saveHistoryDebounced()
          if (!hasSelection) {
            const line = lines.splice(b.line, 1)[0]!
            lines.splice(--b.line, 0, line)
            b.code = lines.join('\n')
            $.flush()
            selection.start.set(selection.end)
            return true
          }
          else {
            const { top, bottom } = selection.sorted
            if (top.y === 0) return

            const slice = lines.splice(top.y, bottom.y - top.y + 1)
            lines.splice(--top.y, 0, ...slice)
            --bottom.y
            b.code = lines.join('\n')
          }
        }

        --b.line
        // return true
      }],

      [[{ special: 'ArrowRight' }], (): Keyboard.Result => {
        if (b.col === text.length && b.line === maxLine) return
        if (b.col < text.length && ctrl) {
          const words = parseWords(WORD, text)
          let word
          out: {
            for (let i = 0; i < words.length; i++) {
              word = words[i]!
              if (word.index > b.col) {
                b.col = word.index
                break out
              }
            }
            b.col = text.length
          }
        }
        else {
          ++b.col
        }
        if (b.col > text.length) {
          b.col = 0
          ++b.line
        }
        b.coli = b.col
        // return true
      }],

      [[{ special: 'ArrowLeft' }], (): Keyboard.Result => {
        if (b.col === 0 && b.line === 0) return
        if (b.col > 0 && ctrl) {
          const words = parseWords(WORD, text)
          let word
          out: {
            for (let i = words.length - 1; i >= 0; --i) {
              word = words[i]!
              if (word.index < b.col) {
                b.col = word.index
                break out
              }
            }
            b.col = 0
          }
        }
        else {
          --b.col
        }
        if (b.col < 0) {
          --b.line
          text = lines[b.line]!
          b.col = text.length
        }
        b.coli = b.col
        // return true
      }],

      [[
        { special: 'PageUp' },
        { special: 'PageDown' }
      ], (): Keyboard.Result => {
        if (special === 'PageDown') {
          targetLine = b.line + page
          if (targetLine >= maxLine) {
            targetLine = maxLine
            b.col = lines[maxLine]!.length
          }
        }
        else {
          targetLine = b.line - page
          if (targetLine <= 0) {
            targetLine = 0
            b.col = 0
          }
        }
        dy = targetLine - b.line
        b.line = targetLine
        scroll.targetScroll.top -= dy * lineHeight
        scroll.animSettings = Scroll.AnimSettings.Slow
        // return true
      }],

      [[{ special: 'Home' }], (): Keyboard.Result => {
        NONSPACE.lastIndex = 0
        x = NONSPACE.exec(text)?.index ?? 0
        b.coli = b.col = x === b.col ? 0 : x
        // return true
      }],

      [[{ special: 'End' }], (): Keyboard.Result => {
        b.coli = b.col = text.length
        // return true
      }],

      [[{ special: 'Backspace' }], (): Keyboard.Result => {
        history.saveHistoryDebounced()

        if (selection.hasSelection) {
          selection.deleteSelection.sansHistory()
          return true
        }

        if (b.col > 0 && ctrl) {
          history.saveHistoryMeta()
          selection.start.set({ x: b.col, y: b.line })
          $.flush()
          this.handleKey({ special: 'ArrowLeft', ctrl: true, shift: true })
          $.flush()
          selection.end.set({ x: b.col, y: b.line })
          this.handleKey({ special })
          return true
        }

        if (b.col === 0) {
          if (b.line > 0) {
            const y = b.line

            --b.line
            b.col = b.coli = lines[b.line]!.length
            lines[b.line] += text
            b.lines!.splice(y, 1)
            b.code = b.lines!.join('\n')
          }
        }
        else {
          lines[b.line] =
            text.slice(0, b.col - 1)
            + text.slice(b.col)
          b.coli = b.col - 1
          b.col = b.coli
          b.code = lines.join('\n')
        }

        if (closers.has(currentChar) && text[b.col] === Close[currentChar]) {
          this.handleKey({ special: 'Delete' })
        }

        return true
      }],

      [[{ special: 'Delete' }], (): Keyboard.Result => {
        history.saveHistoryDebounced()

        if (selection.hasSelection) {
          selection.deleteSelection.sansHistory()
          return true
        }

        if (shift) {
          if (b.line === maxLine && !maxLine) {
            if (text.length) {
              selection.start.zero()
              selection.end.zero().x = text.length
              selection.deleteSelection()
            }
            return true
          }

          selection.start.zero().y = b.line
          if (b.line === maxLine && b.col === 0) {
            selection.end.zero().y = b.line - 1
          }
          else {
            selection.end.zero().y = b.line + 1
          }
          selection.deleteSelection()
          return true
        }

        if (ctrl) {
          history.saveHistoryMeta()
          selection.start.set({ x: b.col, y: b.line })
          $.flush()
          this.handleKey({ special: 'ArrowRight', ctrl: true, shift: true })
          $.flush()
          selection.end.set({ x: b.col, y: b.line })
          this.handleKey({ special })
          return true
        }

        if (b.col === text.length) {
          if (b.line < maxLine) {
            lines[b.line] =
              text.slice(0, b.col)
              + lines[b.line + 1]
            lines.splice(b.line + 1, 1)
            b.code = lines.join('\n')
          }
        }
        else {
          lines[b.line] =
            text.slice(0, b.col)
            + text.slice(b.col + 1)
          b.code = lines.join('\n')
        }

        return true
      }],

      [[{ special: 'Tab' }], (e): Keyboard.Result => {
        dom.prevent(e.real)
        if (!selection.hasSelection && !shift) return

        history.saveHistoryDebounced()

        const { hasSelection } = selection
        let index: number = Infinity
        let lns: string[]
        let y: number
        if (hasSelection) {
          const { top, bottom } = selection.sorted
          for (let i = top.y; i <= bottom.y; i++) {
            index = Math.min(index, lineBegin(lines[i]!))
          }
          y = top.y
          lns = lines.slice(top.y, bottom.y + 1)
        }
        else {
          index = lineBegin(text)
          y = b.line
          lns = [lines[y]!]
        }

        const dec = shift
        if (dec && !index) return true

        let diff!: number
        const tabSize = 2
        const tab = ' '.repeat(tabSize)
        lns.forEach((text, i) => {
          if (dec) {
            diff = -tabSize
            text = text.replace(new RegExp(`^(\t| {1,${tabSize}})`, 'gm'), '')
          }
          else {
            diff = +tabSize
            text = text.length === 0 ? tab : text.replace(/^[^\n]/gm, `${tab}$&`)
          }
          lines[y + i] = text
        })
        b.coli = Math.max(0, b.coli + diff)
        b.col = b.coli

        b.code = lines.join('\n')
        if (hasSelection) {
          selection.start.x += diff
          selection.end.x += diff
        }
        else {
          $.flush()
          selection.start.set(selection.end)
        }
        return true
      }],

      [[{ ctrl: true }], (): Keyboard.Result =>
        match('ctrl', keypress, [
          [[{ char: 'a' }], (): Keyboard.Result => {
            // TODO: test that it does fill the textarea
            b.getLineColFromIndex(0, selection.start)
            b.getLineColFromIndex(code.length, selection.end)
            return true
          }],

          [[{ char: 'D' }], (): Keyboard.Result => {
            history.saveHistoryDebounced()
            if (hasSelection) {
              const { top, bottom } = selection.sorted
              const p1 = b.getIndexFromLineCol(top)
              const p2 = b.getIndexFromLineCol(bottom)
              b.code = code.slice(0, p2)
                + code.slice(p1, p2)
                + code.slice(p2)
              const p = b.getLineColFromIndex(p2 + (p2 - p1))
              $.flush()
              selection.start.set(bottom)
              selection.end.set(p)
              b.line = p.line
              b.coli = b.col = p.col
            }
            else {
              lines.splice(b.line, 0, text)
              b.code = lines.join('\n')
              b.line++
              $.flush()
              selection.start.set(selection.end)
            }
            return true
          }],

          [[{ char: 'b' }], (): Keyboard.Result => {
            selection.selectMatchingBrackets(b.linecol)
            return true
          }],

          [[{ char: 'B' }], (): Keyboard.Result => {
            selection.selectMatchingBrackets(b.linecol, true)
            return true
          }],

          [[{ char: 'z' }], (): Keyboard.Result => {
            scroll.animSettings = Scroll.AnimSettings.Fast
            history.undo()
            return true
          }],

          [[{ char: 'y' }], (): Keyboard.Result => {
            scroll.animSettings = Scroll.AnimSettings.Fast
            history.redo()
            return true
          }],

          [[{ char: ':' }, { char: '?' }], (): Keyboard.Result => {
            history.saveHistoryDebounced()

            if (hasSelection) {
              const { top, bottom } = selection.sorted
              const p1 = b.getIndexFromLineCol(top)
              const p2 = b.getIndexFromLineCol(bottom)
              const dx = 2 + (top.y === bottom.y ? 2 : 0)
              if (code.slice(p1, p1 + 2) === '/;'
                && code.slice(p2 - 2, p2) === ';/'
              ) {
                b.code = code.slice(0, p1)
                  + code.slice(p1 + 2, p2 - 2)
                  + code.slice(p2)
                if (b.line === bottom.y && b.col === bottom.x) b.coli -= dx
                bottom.x -= dx
              }
              else {
                b.code = code.slice(0, p1)
                  + '/;'
                  + code.slice(p1, p2)
                  + ';/'
                  + code.slice(p2)
                if (b.line === bottom.y && b.col === bottom.x) b.coli += dx
                bottom.x += dx
              }
              b.col = b.coli
            }
            else {
              const index = b.getIndexFromLineCol(b.linecol)
              const match = findMatchingBrackets(code, index)
              if (match) {
                if (code[match[0] + 1] === ';') {
                  b.code = code.slice(0, match[0] + 1) + code.slice(match[0] + 2)
                  b.coli--
                }
                else {
                  b.code = code.slice(0, match[0] + 1) + ';' + code.slice(match[0] + 1)
                  b.coli++
                }
              }
              $.flush()
              selection.start.set(selection.end)
            }

            return true
          }],

          [[{ char: ';' }, { char: '/' }], (): Keyboard.Result => {
            history.saveHistoryDebounced()

            const c = misc.lineComment
            const ce = escapeRegExp(c)
            let index: number = Infinity
            let lns: string[]
            let y: number
            if (selection.hasSelection) {
              const { top, bottom } = selection.sorted
              for (let i = top.y; i <= bottom.y; i++) {
                index = Math.min(index, lineBegin(lines[i]!))
              }
              y = top.y
              lns = lines.slice(top.y, bottom.y + 1)
            }
            else {
              index = lineBegin(text)
              y = b.line
              lns = [lines[y]!]
            }

            let diff!: number
            const dec = lns.every((text) => text.trimStart().slice(0, c.length) === c)
            lns.forEach((text, i) => {
              if (dec) {
                const r = new RegExp(`^([^${ce}]*)${ce} ?`, 'gm')
                diff = -(c.length + 1)
                text = text.replace(r, '$1')
              }
              else {
                const r = new RegExp(`^(?!$)([^${ce}]{0,${index}})`, 'gm')
                diff = +(c.length + 1)
                text = text.length === 0
                  ? c + ' '
                  : text.replace(r, `$1${c} `)
              }
              lines[y + i] = text
            })
            b.coli = Math.max(0, b.coli + diff)
            b.col = b.coli
            if (selection.hasSelection) {
              selection.start.x += diff
              selection.end.x += diff
            }
            b.code = lines.join('\n')
            return true
          }]
        ])
      ],

      [[{ ctrl: true }, { alt: true }], (): Keyboard.Result => {
        return true
      }],

      // catchall
      [[], (): Keyboard.Result => {
        if (!char.length) {
          if (!shift) {
            selection.start.set(selection.end)
          }
          return
        }

        history.saveHistoryDebounced()

        if (selection.hasSelection) {
          const { line, col } = b
          const { left, right } = selection.getSelectionIndexes()
          const deletedText = selection.deleteSelection.sansHistory()
          // when it is a bracket opener or closer, reinsert the deleted
          // text but wrapped in that bracket pair
          if (openers.has(char) || closers.has(char)) {
            const o = openers.has(char) ? char : Close[char]
            const c = Open[o]
            b.code = code.slice(0, left)
              + o
              + deletedText
              + c
              + code.slice(right)
            b.linecol.line = line
            b.linecol.col = col
            const index = b.getIndexFromLineCol(b.linecol)
            const p = b.getLineColFromIndex(index + 1)
            b.line = p.line
            b.col = b.coli = p.col
            selection.start.set(selection.end.set(p))
            return true
          }
          lines = b.code!.split('\n')
          text = lines[b.line]!
        }

        const hasBracketLeft = Open[text[b.col - 1]]
        const hasBracketRight = Close[text[b.col]]
        const hasSpaceRight = (b.col === text.length) || SPACE.test(text[b.col])
        const isInBrackets = ((b.col === text.trimEnd().length - 1) && hasBracketRight && hasBracketLeft)
        const beginOfLine = lineBegin(text) ?? 0

        const isEnter = char === '\n'
        const indent = (isEnter
          ? ' '.repeat(b.col === text.trimEnd().length || isInBrackets ? beginOfLine : 0) //b.col)
          + ' '.repeat(hasBracketLeft ? 2 : 0)
          : '')

        const isCharSameAsBracketRight = closers.has(char) && char === text[b.col]

        if (!isCharSameAsBracketRight) {
          lines[b.line] =
            text.slice(0, b.col)
            + char
            + indent + (isEnter && isInBrackets ? '\n' + ' '.repeat(beginOfLine) : '')
            + text.slice(b.col)

          b.code = lines.join('\n')
        }

        if (isEnter) {
          b.coli = indent.length
          ++b.line
        }
        else {
          b.coli = b.col + char.length
        }
        b.col = b.coli

        if (hasSpaceRight && openers.has(char)) {
          this.handleKey({ char: Open[char] })
          b.coli--
          b.col = b.coli
        }

        selection.start.set(selection.end.set({ x: b.col, y: b.line }))

        return true
      }],
    ], DEBUG ? ((category, matcher, result) => {
      console.log(
        category,
        matcher?.special ?? matcher?.char ?? '(catchall)',
        { char, special, ctrl, shift, alt },
        result
      )
    }) : () => { })
  }
}
