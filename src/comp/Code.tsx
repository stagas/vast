import { Signal } from 'signal-jsx'
import { Point, Rect } from 'std'
import { dom, drawText, isMobile, rafs } from 'utils'
import { CODE_WIDTH } from '../constants.ts'
import { createEditor } from '../editor/editor.ts'
import { Keyboard } from '../editor/keyboard.ts'
import { Pointer } from '../editor/pointer.ts'
import { Token } from '../lang/tokenize.ts'
import { state } from '../state.ts'
import { Canvas } from './Canvas.tsx'

let initial = true

export function Code() {
  using $ = Signal()

  const fontSize = '16px'
  const font = 'Mono'
  const textLeft = 19
  const textTop = 20
  const lineHeight = 17

  const brand = '#ff381f'
  const brand2 = '#6838ff'

  const TokenColors = {
    [Token.Type.Op]: '#666',
    [Token.Type.Id]: brand,
    [Token.Type.Keyword]: brand2,
    [Token.Type.Number]: '#fff',
    [Token.Type.Comment]: '#444',
  } as any

  // const AstNodeColors = {
  //   [AstNode.Type.Id]: '#888',
  // } as any

  const Builtin = {
    sr: brand2,
    t: brand2,
    rt: brand2,
    co: brand2,
  }

  let metrics: any

  const sparePoint = $(new Point)

  const view = $(new Rect, { pr: state.$.pr })
  const rect = $(new Rect, { pr: state.$.pr })

  const info = $({
    redraw: 0
  })

  let c: CanvasRenderingContext2D
  const canvas = Canvas({ view, onresize })
  canvas.style.position = 'absolute'
  canvas.style.left = '0'
  canvas.style.zIndex = '10'
  c = canvas.getContext('2d', { alpha: true })!

  function onresize() {
    c?.scale(state.pr, state.pr)
    info.redraw++
  }

  const keyboard = $(new Keyboard)
  const pointer = $(new Pointer)
  pointer.element = canvas
  pointer.offset.y = 44
  // dom.on(window, 'mouseup', (e) => {
  //   if (e.currentTarget)
  //   keyboard.textarea.focus()
  // })
  keyboard.onKeyboardEvent = (kind: Keyboard.EventKind): Keyboard.Result => {
    // const widget = state.focusedPlayer

    // if (kind === Keyboard.EventKind.Down
    //   && keyboard.ctrl
    //   && keyboard.key?.value === 'Enter') {
    //   widget?.playToggle()
    //   return true
    // }

    // if (widget) {
    editor.text.onKeyboardEvent(kind)
    // }
  }
  // keyboard.appendTo(dom.body)

  if (!isMobile()) {
    keyboard.textarea.focus()
    setTimeout(() => {
      keyboard.textarea.focus()
    }, 100)
  }

  const editor = createEditor(rect, c, Token, keyboard, pointer)
  editor.text.offset.y = 42
  editor.dims.lineHeight = lineHeight

    ; (async () => {
      if (initial) {
        initial = false
        await document.fonts.ready
        await rafs(100)
      }

      editor.buffer.source = state.source

      editor.text.padding.setParameters(textLeft, textTop)

      // Pointer Target

      const target = {
        rect,
        handler: () => {
          const metrics = editor.c.measureText('M')
          let charWidth = metrics.width

          editor.dims.charWidth = charWidth
          editor.dims.lineHeight = lineHeight
          if (editor.text.onMouseEvent(pointer.type)) {
            editor.keyboard.textarea.focus({ preventScroll: true })
            // dom.stop.prevent(pointer.real!)
          }
        }
      }
      pointer.targets.add(target)

      $.fx(() => dom.on(window, 'resize', $.fn(() => {
        view.setParameters(0, 0, CODE_WIDTH, window.innerHeight - 85)
        rect.set(view)
        editor.view.set(rect)
      }), { passive: true, unsafeInitial: true }))

      $.fx(() => {
        const { tokens } = $.of(editor.buffer.source)
        // const { tokensAstNode, error } = state
        const { redraw } = info
        const { colors } = state
        const { w, h } = rect
        const { line, col } = editor.buffer
        const { x, y } = editor.scroll
        const { isFocused } = editor.misc
        const { selection: {
          sorted: { top: { x: tx, y: ty },
            bottom: { x: bx, y: by } } } } = editor
        $()
        drawText()
      })

      $.fx(() => {
        const { x, y } = editor.scroll.targetScroll
        $()
        editor.scroll.pos.setParameters(x, y)
      })

      function linecolToPos(t: { line: number, col: number }) {
        return sparePoint.setParameters(
          Math.round(t.col * metrics.width + textLeft),
          Math.round(t.line * lineHeight + textTop)
        )
      }

      function drawText() {
        // if (!state.active) return
        if (!editor.buffer.source.lines) return

        const c = editor.c
        c.textBaseline = 'top'
        c.textAlign = 'left'
        c.font = `${fontSize} "${font}"`

        metrics = c.measureText('M')

        editor.clear()

        c.save()

        editor.view.clipExact(c)
        editor.view.fill(c, '#000000c5') //state.colors['base-100'] + 'e0') // '#000b')

        c.translate(-.5, -.5)
        c.translate(editor.view.x, editor.view.y)
        c.translate(editor.scroll.x, editor.scroll.y)

        editor.selection.renderable.draw(c, sparePoint.setParameters(textLeft, textTop - 2))

        // draw caret
        const { x: caretX, y: caretY } = linecolToPos(editor.buffer)
        if (editor.misc.isFocused) {
          c.fillStyle = '#aaa'
          c.fillRect(caretX - .85, caretY - 2.5, 1.5, lineHeight + 1)
        }

        // draw tokens
        c.lineWidth = 0.35 // stroke width
        editor.buffer.source.tokens.forEach(t => {
          c.strokeStyle =
            c.fillStyle =
            (Builtin as any)[t.text] ??
            // AstNodeColors[state.tokensAstNode.get(tokensCopyMap.get(t)!)?.type ?? -1] ??
            TokenColors[t.type] ??
            '#fff'

          const { x, y } = linecolToPos(t)

          // c.strokeStyle = '#000b'
          // c.lineWidth = 4
          // c.strokeText(t.text, x, y)

          // c.strokeStyle = c.fillStyle
          // c.lineWidth = .75
          c.strokeText(t.text, x, y)

          c.fillText(t.text, x, y)
        })

        // c.lineWidth = 2
        // editor.view.stroke(c, '#fff')

        // if (state.error) {
        //   const nodes = (state.error as any)?.cause?.nodes as (AstNode | Token)[]
        //   const flatTokens = nodes.flatMap(n => {
        //     if (n instanceof AstNode) {
        //       return n.captured
        //     }
        //     else {
        //       return n
        //     }
        //   }).filter(Boolean).map(t => tokensCopyRevMap.get(t)).filter(Boolean)
        //   flatTokens.forEach(t => {
        //     const { x, y } = linecolToPos(t)
        //     c.fillStyle = '#ff0'
        //     c.fillRect(x, y + lineHeight - 6, t.text.length * metrics.width, 2)
        //   })
        //   const last = flatTokens.at(-1)
        //   if (last) {
        //     const { x, y } = linecolToPos(last)
        //     const w = state.error.message.length * metrics.width
        //     const mx = Math.max(0, x - w / 2)
        //     const my = y + lineHeight
        //     c.fillStyle = '#000c'
        //     c.fillRect(mx, my, w, lineHeight)
        //     c.fillStyle = '#ff0'
        //     c.fillText(state.error.message, mx, my)
        //   }
        // }
        c.restore()

        // console.log('draw')
      }

    })()

  return { canvas, editor, textarea: keyboard.textarea }
}
