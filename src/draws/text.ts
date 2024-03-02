import { Signal } from 'signal-jsx'
import { Point, Rect } from 'std'
import { dom, luminate } from 'utils'
import { Canvas } from '../comp/Canvas.tsx'
import { CODE_WIDTH } from '../constants.ts'
import { state } from '../state.ts'
import { Surface } from '../surface.ts'
import { fromSvg } from '../util/svg-to-image.ts'
import { Grid } from './grid.ts'

const DEBUG = true

export type TextDraw = ReturnType<typeof TextDraw>

export function TextDraw(surface: Surface, grid: Grid, view: Rect) {
  using $ = Signal()

  const textView = $(new Rect, { pr: state.$.pr }).set(view)
  const hitArea = $(new Rect)
  const r = $(new Rect)

  const mousePos = $(new Point)

  function handleHover(e: MouseEvent | WheelEvent) {
    mousePos.x = e.pageX * state.pr
    mousePos.y = e.pageY * state.pr

    r.set(hitArea)
    r.zoomLinear(5)
    if (mousePos.withinRect(r)) {
      e.stopImmediatePropagation()
      e.preventDefault()
      grid.updateHoveringBox(grid.info.focusedBox)
      if (e.type !== 'wheel') {
        canvas.style.pointerEvents = 'all'
        state.isHoveringToolbar = true
      }
      dom.body.style.cursor = 'pointer'
    }
    else {
      if (e.type !== 'wheel') {
        canvas.style.pointerEvents = 'none'
        state.isHoveringToolbar = false
      }
      dom.body.style.cursor = ''
    }
    surface.anim.info.epoch++
  }

  $.fx(() => dom.on(window, 'mousemove', $.fn((e: MouseEvent) => {
    if (!grid?.info.focusedBox) {
      state.isHoveringToolbar = false
      return
    }
    handleHover(e)
  }), { capture: true }))

  const canvas = Canvas({ view: textView })
  canvas.style.position = 'absolute'
  canvas.style.pointerEvents = 'none'
  canvas.style.imageRendering = 'pixelated'
  canvas.style.left = CODE_WIDTH + 'px'
  canvas.style.top = '0px'

  $.fx(() => dom.on(canvas, 'wheel', (e) => {
    grid.handleWheelZoom(e)
    handleHover(e)
  }, { passive: true }))

  $.fx(() => {
    const { mode } = state
    $()
    textView.set(view)
    textView.h = window.innerHeight
    if (mode === 'edit' || mode === 'dev') {
      canvas.style.left = (CODE_WIDTH - 1) + 'px'
      textView.w -= CODE_WIDTH
      textView.x += CODE_WIDTH
    }
    else {
      canvas.style.left = '0px'
    }
  })

  const c = canvas.getContext('2d', { alpha: true })!
  c.imageSmoothingEnabled = false
  c.save()

  const color = '#000'
  const icons = $({
    snap: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="42" width="42" viewBox="0 0 32 32">
        <path fill="currentColor" d="M5 5v22h22V5zm2 2h8v8H7zm10 0h8v8h-8zM7 17h8v8H7zm10 0h8v8h-8z" />
      </svg>
    `, color)),
    beat: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="44" width="44" viewBox="0 0 24 24">
        <path fill="currentColor" d="M14 3v10.56c-.59-.35-1.27-.56-2-.56c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V3z" />
      </svg>
    `, color)),
    shuffle: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="57" width="57" viewBox="0 0 24 24">
        <path fill="currentColor" d="M16.47 5.47a.75.75 0 0 0 0 1.06l.72.72h-3.813a1.75 1.75 0 0 0-1.575.987l-.21.434a.4.4 0 0 0 0 .35l.568 1.174a.2.2 0 0 0 .36 0l.632-1.304a.25.25 0 0 1 .225-.141h3.812l-.72.72a.75.75 0 1 0 1.061 1.06l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-1.06 0m-6.436 9.859a.4.4 0 0 0 0-.35l-.57-1.174a.2.2 0 0 0-.36 0l-.63 1.304a.25.25 0 0 1-.226.141H5a.75.75 0 0 0 0 1.5h3.248a1.75 1.75 0 0 0 1.575-.987z" />
        <path fill="currentColor" d="M16.47 18.53a.75.75 0 0 1 0-1.06l.72-.72h-3.813a1.75 1.75 0 0 1-1.575-.987L8.473 8.89a.25.25 0 0 0-.225-.141H5a.75.75 0 0 1 0-1.5h3.248c.671 0 1.283.383 1.575.987l3.329 6.872a.25.25 0 0 0 .225.141h3.812l-.72-.72a.75.75 0 1 1 1.061-1.06l2 2a.75.75 0 0 1 0 1.06l-2 2a.75.75 0 0 1-1.06 0" />
      </svg>
    `, color)),
    quantize: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="46" width="46" viewBox="0 0 256 256">
        <path fill="currentColor" d="M252 56a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12H84v36a12 12 0 0 1-12 12H16a12 12 0 0 1 0-24h44v-36a12 12 0 0 1 12-12h44v-36a12 12 0 0 1 12-12h44V56a12 12 0 0 1 12-12h56a12 12 0 0 1 12 12" />
      </svg>
    `, color)),
    duplicate: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="58" width="58" viewBox="0 0 32 32">
        <rect fill="currentColor" x="6" y="8" height="8" width="8" />
        <rect fill="currentColor" x="22" y="8" height="8" width="8" />
        <path stroke="currentColor" d="M 6 12 L 22 12" />
      </svg>
    `, color)),
  })

  $.fx(() => {
    const { snap, beat, shuffle, quantize } = $.of(icons)
    $()
    surface.anim.info.epoch++
  })

  const tick = () => {
    return;

    c.restore()
    c.save()

    if (!grid || !surface) return
    const m = surface.viewMatrix
    c.translate(-textView.x * state.pr, 0)

    r.set(hitArea)
    r.y -= r.h
    r.h *= 2
    r.zoomLinear(5)
    r.clear(c)

    if (!grid?.info.focusedBox) {
      c.restore()
      c.save()
      return
    }

    c.beginPath()

    const data = grid.info.focusedBox!
    const pr = state.pr
    const w = (data.w * m.a * pr)
    let x = data.x * m.a * pr + m.e * pr //+ 40
    if (x < (CODE_WIDTH + 55) * pr) x = (CODE_WIDTH + 55) * pr
    // if (mousePos.x >= x + w / 2) x += w - hitArea.w
    let y = data.y * m.d * pr + m.f * pr + 45.5 * pr + 1
    const h = (data.h * m.d * pr)
    const bh = 75
    c.font = '29px Mono'
    // @ts-ignore
    c.letterSpacing = '-.035em'
    let snapText = '32'
    let beatText = '4'

    hitArea.x = x
    hitArea.y = y //- bh
    hitArea.w = data.w * m.a * pr //ix - hitArea.x - 10
    hitArea.h = bh
    hitArea.path(c)
    c.lineWidth = state.pr * 2
    const dark = data.hexColor // luminate(state.colors['base-100'], -0.04)
    c.fillStyle = dark

    c.fill()
    c.clip()

    c.fillStyle = '#000' //state.colors['base-content']
    c.textBaseline = 'middle'
    c.textAlign = 'left'

    let ix = x + 13
    let iw = 50

    function hoverImg(cond: boolean, x: any) {
      if (cond) return x.img_hover
      else return x.img
    }

    let hoveringItem: any
    function put(item: any, w: number, y: number, xOffset: number = 0) {
      const isHovering = state.isHoveringToolbar && mousePos.x >= ix - 15 && mousePos.x < ix - 15 + w
      if (isHovering) {
        hoveringItem = item
        c.fillStyle = state.colors['base-100']
        c.fillRect(ix - 10, hitArea.y, w, hitArea.h)
      }
      c.fillStyle = isHovering ? state.colors['base-content'] : '#000' ///* isHovering ? state.colors.primary :  */state.colors['base-content']
      c.drawImage(isHovering ? item.img_hover : item.img, ix + xOffset, y)
      ix += w
    }
    c.lineWidth = 0.4
    c.strokeStyle = '#000'
    let tx = ix
    let yy = y
    if (icons?.snap) put(icons.snap, iw * 1.95, yy + 15.5)
    let xx = Math.floor(tx + iw * 0.85)
    c.fillText(snapText, xx, yy + bh / 2 + 3.5)
    c.strokeText(snapText, xx, yy + bh / 2 + 3.5)
    tx = ix
    if (icons?.beat) put(icons.beat, iw * 1.2 + beatText.length * 16, yy + 13.4)
    xx = Math.floor(tx + iw * 0.75)
    c.fillText(beatText, xx, yy + bh / 2 + 3.5)
    c.strokeText(beatText, xx, yy + bh / 2 + 3.5)
    if (icons?.shuffle) put(icons.shuffle, iw * 1.50, yy + 8.5, 3.5)
    if (icons?.quantize) put(icons.quantize, iw * 1.50, yy + 14, 9)
    if (icons?.duplicate) put(icons.duplicate, iw * 1.50, yy + 14, 1)

    // hitArea.w = ix - hitArea.x - 10

    // let explainText = ''
    // if (hoveringItem === icons.snap) explainText = 'snap ' + snapText
    // if (hoveringItem === icons.beat) explainText = 'beat ' + beatText
    // if (hoveringItem === icons.shuffle) explainText = 'shuffle notes'
    // if (hoveringItem === icons.quantize) explainText = 'quantize notes'
    // if (hoveringItem === icons.duplicate) explainText = 'duplicate pattern'
    // if (explainText) {
    //   c.textBaseline = 'bottom'
    //   c.textAlign = 'center'
    //   c.font = '24px Mono'
    //   c.fillStyle = dark + '75'
    //   c.fillRect(hitArea.x, hitArea.y - (hitArea.h - 5), hitArea.w, hitArea.h)
    //   c.fillStyle = state.colors['base-content']
    //   c.fillText(explainText, hitArea.x + hitArea.w / 2, hitArea.y - 5)
    // }
    c.restore()
    c.save()
  }

  $.fx(() => {
    surface.anim.ticks.add(tick)
    return () => {
      surface.anim.ticks.delete(tick)
    }
  })

  return { canvas, c, hitArea }
}
