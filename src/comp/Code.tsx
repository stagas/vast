import { Signal } from 'signal-jsx'
import { Point, Rect } from 'std'
import { dom, isMobile } from 'utils'
import { CODE_WIDTH } from '../constants.ts'
import { Editor, createEditor } from '../editor/editor.ts'
import { Keyboard } from '../editor/keyboard.ts'
import { Pointer, PointerEventType } from '../editor/pointer.ts'
import { Token } from '../lang/tokenize.ts'
import { state } from '../state.ts'
import { Canvas } from './Canvas.tsx'

export function Code() {
  using $ = Signal()

  const info = $({
    redraw: 0,

    focusedEditor: null as Editor | null,

    font: 'Mono',
    textLeft: 19,
    textTop: 6,

    fontSize: '15px',
    lineHeight: 18,
  })


  // const AstNodeColors = {
  //   [AstNode.Type.Id]: '#888',
  // } as any


  let metrics: any

  const sparePoint = $(new Point)

  const view = $(new Rect, { pr: state.$.pr, y: 44, w: CODE_WIDTH, h: window.innerHeight - 44 })
  // const rect = $(new Rect, { pr: state.$.pr })

  let c: CanvasRenderingContext2D
  const canvas = Canvas({ view, onresize })
  canvas.style.position = 'absolute'
  canvas.style.left = '0'
  canvas.style.zIndex = '10'
  c = canvas.getContext('2d', { alpha: true })!

  function drawBigScrollbar() {
    const m = state.viewMatrix
    c.save()
    c.scale(state.pr, state.pr)
    const vh = view.h

    const co = (vh / (m.d * 2 * (state.tracks.length)))

    const x = view.w - 55
    let y = -.5 - m.f * co * 2 //* state.pr
    const w = 50
    const bottom = window.innerHeight - 50

    let h = vh * co * state.pr //* (1/m.d) * vh / 2

    if (y < 0) {
      h += y
      y = 0
    }

    if (y + h > bottom) h = bottom - y

    y += 2

    c.lineWidth = 2
    c.beginPath()
    c.moveTo(x, y + h)
    c.lineTo(x, y)
    c.lineTo(x + w, y)
    c.strokeStyle = '#fff'
    c.stroke()
    c.beginPath()
    c.moveTo(x + w, y)
    c.lineTo(x + w, y + h)
    c.lineTo(x, y + h)
    c.strokeStyle = '#444'
    c.stroke()

    for (const t of state.tracks) {
      c.beginPath()
      const y = (t.info.y) * (view.h / (state.tracks.length)) + 2
      c.moveTo(x + 10, y)
      c.lineTo(x + 10 + w - 17, y)
      c.lineWidth = 4
      c.strokeStyle = t.info.shape?.data.hexColor ?? '#fff'
      c.stroke()
    }

    c.restore()
  }

  function onresize() {
    // c?.scale(state.pr, state.pr)
    info.redraw++
  }

  $.fx(() => {
    const { focusedEditor } = $.of(info)
    $()
    focusedEditor.misc.isFocused = true
    return () => {
      focusedEditor.misc.isFocused = false
    }
  })
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
    info.focusedEditor?.text.onKeyboardEvent(kind)
    // }
  }
  // keyboard.appendTo(dom.body)

  if (!isMobile()) {
    keyboard.textarea.focus()
    setTimeout(() => {
      keyboard.textarea.focus()
    }, 100)
  }

  function createEditorView(rect: Rect) {

    const editorInfo = $({
      redraw: 0,

      brand: '#ff381f',
      brand2: '#6838ff',

      get TokenColors() {
        return {
          [Token.Type.Op]: '#666',
          [Token.Type.Id]: this.brand,
          [Token.Type.Keyword]: this.brand2,
          [Token.Type.Number]: '#fff',
          [Token.Type.Comment]: '#444',
        } as any
      },
      get Builtin() {
        return {
          sr: this.brand2,
          t: this.brand2,
          rt: this.brand2,
          co: this.brand2,
        } as any
      }
    })

    const editor = createEditor(rect, c, Token, keyboard, pointer)
    editor.text.offset.y = 42
    editor.dims.lineHeight = info.lineHeight

    const prev = $(new Rect)
    prev.set(editor.view)

    const targetRect = $(new Rect)

    // $.fx(() => {
    //   const { source } = state
    //   $()
    //   editor.buffer.source = source
    // })

    editor.text.padding.setParameters(info.textLeft, info.textTop)

    // Pointer Target

    const target = {
      rect: targetRect,
      handler: () => {
        if (pointer.type === PointerEventType.Down) {
          info.focusedEditor = editor
        }

        const metrics = editor.c.measureText('M')
        let charWidth = metrics.width

        editor.dims.charWidth = charWidth
        editor.dims.lineHeight = info.lineHeight
        if (editor.text.onMouseEvent(pointer.type)) {
          editor.keyboard.textarea.focus({ preventScroll: true })
          // dom.stop.prevent(pointer.real!)
        }
      }
    }
    pointer.targets.add(target)

    $.fx(() => {
      const { y } = rect
      const { d, f } = state.viewMatrix
      {
        const { d, f } = state.matrix
      }
      $()
      editor.view.setParameters(0, y * d + f, CODE_WIDTH, 2 * d)
      // editor.clear()
      // console.log(editor.view.text)
      // editor.view.set(view)
      targetRect.set(editor.view)
      targetRect.pr = editor.view.pr
      // targetRect.y -= 44
      targetRect.h = d
      // targetRect.w = CODE_WIDTH * state.pr
      // targetRect.stroke(c, '#fff')
      // targetRect.y
      // info.redraw++
      // target.rect.set(view)

    })

    // $.fx(() => dom.on(window, 'resize', $.fn(() => {
    //   $.untrack(() => {
    //   })
    // }), { passive: true, unsafeInitial: true }))

    $.fx(() => {
      const { source } = $.of(editor.buffer)
      const { tokens } = $.of(source)
      // const { tokensAstNode, error } = state
      // const { redraw } = info
      const { TokenColors, Builtin } = editorInfo
      const { colors } = state
      const { w, h } = rect
      const { line, col } = editor.buffer
      const { x, y } = editor.scroll
      const { x: vx, y: vy } = editor.view
      const { isFocused } = editor.misc
      const { selection: {
        sorted: { top: { x: tx, y: ty },
          bottom: { x: bx, y: by } } } } = editor
      $()
      info.redraw++
    })

    // $.fx(() => {
    //   const { redraw } = editorInfo
    //   $()
    //   drawText()
    // })

    $.fx(() => {
      const { x, y } = editor.scroll.targetScroll
      $()
      editor.scroll.pos.setParameters(x, y)
    })

    function linecolToPos(t: { line: number, col: number }) {
      return sparePoint.setParameters(
        Math.round(t.col * metrics.width + info.textLeft),
        Math.round(t.line * info.lineHeight + info.textTop)
      )
    }

    function drawText() {
      // if (!state.active) return
      if (!editor.buffer.source?.lines) return

      // info.lineHeight = Math.floor(9 * ((editor.view.h / window.innerHeight * 3) ** 0.45))
      // info.fontSize = (info.lineHeight * 0.9) + 'px'

      const c = editor.c
      c.textBaseline = 'top'
      c.textAlign = 'left'
      c.font = `${info.fontSize} "${info.font}"`

      metrics = c.measureText('M')

      // prev.clear(c)
      prev.set(editor.view)
      // editor.clear()

      c.save()

      // editor.view.clipExact(c)
      c.scale(state.pr, state.pr)
      c.beginPath()
      c.rect(0, editor.view.y, editor.view.w_pr, editor.view.h / state.pr - 1)
      // c.fillStyle = '#f00'
      c.clip()
      //state.colors['base-100'] + 'e0') // '#000b')

      // editor.view.fill(c, '#000b')

      c.translate(-.5, -.5)
      c.translate(editor.view.x, editor.view.y)
      c.translate(editor.scroll.x, editor.scroll.y)

      editor.selection.renderable.draw(c, sparePoint.setParameters(info.textLeft, info.textTop - 2))

      // draw caret
      const { x: caretX, y: caretY } = linecolToPos(editor.buffer)
      if (editor.misc.isFocused) {
        c.fillStyle = '#aaa'
        c.fillRect(caretX - .85, caretY - 2.5, 1.5, info.lineHeight + 1)
      }

      // draw tokens
      c.lineWidth = 0.35 // stroke width
      editor.buffer.source.tokens.forEach(t => {
        c.strokeStyle =
          c.fillStyle =
          editorInfo.Builtin[t.text] ??
          // AstNodeColors[state.tokensAstNode.get(tokensCopyMap.get(t)!)?.type ?? -1] ??
          editorInfo.TokenColors[t.type] ??
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

    return { editor, editorInfo, drawText }
  }

  function clearCanvas() {
    c.clearRect(0, 0, view.w_pr, view.h_pr)
    c.fillStyle = '#000b'
    c.fillRect(0, 0, view.w_pr, view.h_pr)
  }

  return { info, canvas, createEditorView, clearCanvas, drawBigScrollbar, textarea: keyboard.textarea }
}
