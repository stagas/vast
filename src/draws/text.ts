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

  async function fromSvg(svg: string) {
    const markup = svg.trim().replaceAll('currentColor', state.colors['base-content'])
    const img = new Image()
    await new Promise(resolve => {
      img.onload = resolve
      img.src = 'data:image/svg+xml,' + encodeURIComponent(markup)
    })
    return { markup, img }
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
    let y = data.y * m.d * 2 + m.f * 2 + 46 * 2
    // const w = (data.w * m.a * 2)
    const h = (data.h * m.d * 2)
    const bh = 45
    c.font = '31px Mono'
    // @ts-ignore
    c.letterSpacing = '-.035em'
    const text = '  32   4b'
    // const metrics = c.measureText(text)
    // if (data.y === 0) {
    //   c.rect(x, y + h, metrics.width + 12, bh)
    // }
    // else {
    const padX = 50
    hitArea.x = x
    hitArea.y = y - bh
    // if (hitArea.y < 0) {
    //   y = hitArea.y = y + h
    //   y += bh
    // }
    hitArea.w = 370 + padX
    hitArea.h = bh
    hitArea.path(c)
    // c.rect(x, y - bh, metrics.width + padX, bh)
    // }
    c.lineWidth = state.pr * 2
    c.fillStyle = state.colors['base-100']


    c.fill()
    c.fillStyle = state.colors['base-content']
    c.textBaseline = 'middle'
    c.textAlign = 'left'
    // if (data.y === 0) {
    //   c.fillText(text, x + 5, y + h + bh / 2 + 3.5)
    // }
    // else {

    let ix = x
    let iw = 50
    if (icons?.snap) c.drawImage(icons.snap.img, ix += padX / 2, y - bh + 6)
    if (icons?.beat) c.drawImage(icons.beat.img, ix += iw * 2, y - bh + 4.4)
    if (icons?.shuffle) c.drawImage(icons.shuffle.img, ix += iw * 1.75, y - bh - 1.5)
    if (icons?.quantize) c.drawImage(icons.quantize.img, ix += iw * 1.45, y - bh + 4)
    if (icons?.duplicate) c.drawImage(icons.duplicate.img, ix + iw * 1.15, y - bh + 4)

    c.fillText(text, x + padX / 2, y - bh / 2 + 3.5)
    // }
    c.restore()
    c.save()
  })

  return { canvas, hitArea }
}
