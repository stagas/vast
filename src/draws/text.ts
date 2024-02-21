import { Signal } from 'signal-jsx'
import { log, state } from '../state.ts'
import { Grid } from './grid.ts'
import { Surface } from '../surface.ts'
import { Point, Rect } from 'std'
import { Canvas } from '../comp/Canvas.tsx'
import { Minimap } from '../draws/minimap.ts'
import { CodeDraw } from '../draws/code.ts'
import { CODE_WIDTH } from '../constants.ts'
import { dom } from 'utils'

const DEBUG = true

export type TextDraw = ReturnType<typeof TextDraw>

export function TextDraw(surface: Surface, grid: Grid, view: Rect) {
  using $ = Signal()

  const textView = $(new Rect, { pr: state.$.pr }).set(view)
  const hitArea = $(new Rect)

  const mousePos = $(new Point)
  $.fx(() => dom.on(window, 'mousemove', $.fn((e: MouseEvent) => {
    if (!grid?.info.focusedBox) {
      state.isHoveringToolbar = false
      return
    }
    mousePos.x = e.pageX * state.pr
    mousePos.y = e.pageY * state.pr
    if (mousePos.withinRect(hitArea)) {
      e.stopImmediatePropagation()
      grid.updateHoveringBox(grid.info.focusedBox)
      state.isHoveringToolbar = true
    }
    else {
      state.isHoveringToolbar = false
    }
    surface.anim.info.epoch++
  }), { capture: true }))

  const canvas = Canvas({ view: textView })
  canvas.style.position = 'absolute'
  canvas.style.pointerEvents = 'none'
  canvas.style.imageRendering = 'pixelated'
  canvas.style.left = CODE_WIDTH + 'px'
  canvas.style.top = '0px'
  $.fx(() => {
    const { mode } = state
    $()
    textView.set(view)
    if (mode === 'edit' || mode === 'dev') {
      canvas.style.left = CODE_WIDTH + 'px'
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

  async function svgToImg(svg: string, color: string) {
    const markup = svg.trim().replaceAll('currentColor', color)
    const img = new Image()
    await new Promise(resolve => {
      img.onload = resolve
      img.src = 'data:image/svg+xml,' + encodeURIComponent(markup)
    })
    return img
  }
  async function fromSvg(svg: string) {
    const img = await svgToImg(svg, state.colors['base-content']
    )
    const img_hover = await svgToImg(svg, state.colors['primary'])

    // const markup = svg.trim().replaceAll('currentColor', state.colors['base-content'])
    // const img = new Image()
    // await new Promise(resolve => {
    //   img.onload = resolve
    //   img.src = 'data:image/svg+xml,' + encodeURIComponent(markup)
    // })

    return { img, img_hover }
  }

  const icons = $({
    snap: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="32" width="32" viewBox="0 0 32 32">
        <path fill="currentColor" d="M5 5v22h22V5zm2 2h8v8H7zm10 0h8v8h-8zM7 17h8v8H7zm10 0h8v8h-8z" />
      </svg>
    `)),
    beat: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="34" width="34" viewBox="0 0 24 24">
        <path fill="currentColor" d="M14 3v10.56c-.59-.35-1.27-.56-2-.56c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V3z" />
      </svg>
    `)),
    shuffle: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="47" width="47" viewBox="0 0 24 24">
        <path fill="currentColor" d="M16.47 5.47a.75.75 0 0 0 0 1.06l.72.72h-3.813a1.75 1.75 0 0 0-1.575.987l-.21.434a.4.4 0 0 0 0 .35l.568 1.174a.2.2 0 0 0 .36 0l.632-1.304a.25.25 0 0 1 .225-.141h3.812l-.72.72a.75.75 0 1 0 1.061 1.06l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-1.06 0m-6.436 9.859a.4.4 0 0 0 0-.35l-.57-1.174a.2.2 0 0 0-.36 0l-.63 1.304a.25.25 0 0 1-.226.141H5a.75.75 0 0 0 0 1.5h3.248a1.75 1.75 0 0 0 1.575-.987z" />
        <path fill="currentColor" d="M16.47 18.53a.75.75 0 0 1 0-1.06l.72-.72h-3.813a1.75 1.75 0 0 1-1.575-.987L8.473 8.89a.25.25 0 0 0-.225-.141H5a.75.75 0 0 1 0-1.5h3.248c.671 0 1.283.383 1.575.987l3.329 6.872a.25.25 0 0 0 .225.141h3.812l-.72-.72a.75.75 0 1 1 1.061-1.06l2 2a.75.75 0 0 1 0 1.06l-2 2a.75.75 0 0 1-1.06 0" />
      </svg>
    `)),
    quantize: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="36" width="36" viewBox="0 0 256 256">
        <path fill="currentColor" d="M252 56a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12H84v36a12 12 0 0 1-12 12H16a12 12 0 0 1 0-24h44v-36a12 12 0 0 1 12-12h44v-36a12 12 0 0 1 12-12h44V56a12 12 0 0 1 12-12h56a12 12 0 0 1 12 12" />
      </svg>
    `)),
    duplicate: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" height="48" width="48" viewBox="0 0 32 32">
        <rect fill="currentColor" x="6" y="8" height="8" width="8" />
        <rect fill="currentColor" x="22" y="8" height="8" width="8" />
        <path stroke="currentColor" d="M 6 12 L 22 12" />
      </svg>
    `)),

  })

  // ; (
  //   surface.anim.info.epoch++
  // })()

  $.fx(() => {
    const { snap, beat, shuffle, quantize } = $.of(icons)
    $()
    surface.anim.info.epoch++
  })

  const tick = () => {
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
    let y = data.y * m.d * 2 + m.f * 2 + 46 * 2
    // const w = (data.w * m.a * 2)
    const h = (data.h * m.d * 2)
    const bh = 45
    c.font = '31px Mono'
    // @ts-ignore
    c.letterSpacing = '-.035em'
    let snapText = '32'
    let beatText = '4b'
    // const metrics = c.measureText(text)
    // if (data.y === 0) {
    //   c.rect(x, y + h, metrics.width + 12, bh)
    // }
    // else {

    hitArea.x = x
    hitArea.y = y - bh
    // if (hitArea.y < 0) {
    //   y = hitArea.y = y + h
    //   y += bh
    // }
    hitArea.w = 420
    hitArea.h = bh
    hitArea.path(c)
    // c.rect(x, y - bh, metrics.width + padX, bh)
    // }
    c.lineWidth = state.pr * 2
    c.fillStyle = state.colors['base-300']


    c.fill()
    c.fillStyle = state.colors['base-content']
    c.textBaseline = 'middle'
    c.textAlign = 'left'
    // if (data.y === 0) {
    //   c.fillText(text, x + 5, y + h + bh / 2 + 3.5)
    // }
    // else {

    let ix = x + 13 //+ padX / 2
    let iw = 50

    function hoverImg(cond: boolean, x: any) {
      if (cond) return x.img_hover
      else return x.img
    }

    function put(item: any, w: number, y: number, xOffset: number = 0) {
      const isHovering = state.isHoveringToolbar && mousePos.x > ix && mousePos.x < ix + w
      if (isHovering) {
        c.fillStyle = state.colors['base-100'] //+ '22'
        c.fillRect(ix - 10, hitArea.y, w, hitArea.h)
      }
      c.fillStyle = isHovering ? state.colors.primary : state.colors['base-content']
      c.drawImage(isHovering ? item.img_hover : item.img, ix + xOffset, y)
      ix += w
    }
    let tx = ix
    if (icons?.snap) put(icons.snap, iw * 1.95, y - bh + 6)
    c.fillText(snapText, tx + iw * 0.7, y - bh / 2 + 3.5)
    tx = ix
    if (icons?.beat) put(icons.beat, iw * 1.85, y - bh + 4.4)
    c.fillText(beatText, tx + iw * 0.55, y - bh / 2 + 3.5)
    if (icons?.shuffle) put(icons.shuffle, iw * 1.50, y - bh - 1.5, 3.5)
    if (icons?.quantize) put(icons.quantize, iw * 1.50, y - bh + 4, 9)
    if (icons?.duplicate) put(icons.duplicate, iw * 1.50, y - bh + 4, 1)

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

  return { canvas, hitArea }
}
