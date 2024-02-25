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

export type Heads = ReturnType<typeof Heads>

export function Heads(c: CanvasRenderingContext2D, surface: Surface, grid: Grid, view: Rect) {
  using $ = Signal()

  const selfView = $(new Rect, { pr: state.$.pr }).set(view)
  const hitArea = $(new Rect)
  const r = $(new Rect)

  const mousePos = $(new Point)

  function handleHover(e: MouseEvent | WheelEvent) {
    mousePos.x = e.pageX * state.pr
    mousePos.y = e.pageY * state.pr

    // r.set(hitArea)
    // r.zoomLinear(5)
    // if (mousePos.withinRect(r)) {
    //   e.stopImmediatePropagation()
    //   e.preventDefault()
    //   grid.updateHoveringBox(grid.info.focusedBox)
    //   if (e.type !== 'wheel') {
    //     c.canvas.style.pointerEvents = 'all'
    //     state.isHoveringToolbar = true
    //   }
    //   dom.body.style.cursor = 'pointer'
    // }
    // else {
    //   if (e.type !== 'wheel') {
    //     canvas.style.pointerEvents = 'none'
    //     state.isHoveringToolbar = false
    //   }
    //   dom.body.style.cursor = ''
    // }
    surface.anim.info.epoch++
  }

  $.fx(() => dom.on(window, 'mousemove', $.fn((e: MouseEvent) => {
    if (!grid?.info.focusedBox) {
      state.isHoveringToolbar = false
      return
    }
    handleHover(e)
  }), { capture: true }))

  // const canvas = Canvas({ view: textView })
  // canvas.style.position = 'absolute'
  // canvas.style.pointerEvents = 'none'
  // canvas.style.imageRendering = 'pixelated'
  // canvas.style.left = CODE_WIDTH + 'px'
  // canvas.style.top = '0px'

  // $.fx(() => dom.on(canvas, 'wheel', (e) => {
  //   grid.handleWheelZoom(e)
  //   handleHover(e)
  // }))

  $.fx(() => {
    const { mode } = state
    $()
    selfView.set(view)
    if (mode === 'edit' || mode === 'dev') {
      // canvas.style.left = CODE_WIDTH + 'px'
      selfView.w -= CODE_WIDTH
      selfView.x += CODE_WIDTH
    }
    // else {
    //   // canvas.style.left = '0px'
    // }
  })

  // const c = canvas.getContext('2d', { alpha: true })!
  // c.imageSmoothingEnabled = false
  // c.save()

  // const icons = $({
  //   snap: $.unwrap(() => fromSvg(/*html*/`
  //     <svg xmlns="http://www.w3.org/2000/svg" height="32" width="32" viewBox="0 0 32 32">
  //       <path fill="currentColor" d="M5 5v22h22V5zm2 2h8v8H7zm10 0h8v8h-8zM7 17h8v8H7zm10 0h8v8h-8z" />
  //     </svg>
  //   `)),
  //   beat: $.unwrap(() => fromSvg(/*html*/`
  //     <svg xmlns="http://www.w3.org/2000/svg" height="34" width="34" viewBox="0 0 24 24">
  //       <path fill="currentColor" d="M14 3v10.56c-.59-.35-1.27-.56-2-.56c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V3z" />
  //     </svg>
  //   `)),
  //   shuffle: $.unwrap(() => fromSvg(/*html*/`
  //     <svg xmlns="http://www.w3.org/2000/svg" height="47" width="47" viewBox="0 0 24 24">
  //       <path fill="currentColor" d="M16.47 5.47a.75.75 0 0 0 0 1.06l.72.72h-3.813a1.75 1.75 0 0 0-1.575.987l-.21.434a.4.4 0 0 0 0 .35l.568 1.174a.2.2 0 0 0 .36 0l.632-1.304a.25.25 0 0 1 .225-.141h3.812l-.72.72a.75.75 0 1 0 1.061 1.06l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-1.06 0m-6.436 9.859a.4.4 0 0 0 0-.35l-.57-1.174a.2.2 0 0 0-.36 0l-.63 1.304a.25.25 0 0 1-.226.141H5a.75.75 0 0 0 0 1.5h3.248a1.75 1.75 0 0 0 1.575-.987z" />
  //       <path fill="currentColor" d="M16.47 18.53a.75.75 0 0 1 0-1.06l.72-.72h-3.813a1.75 1.75 0 0 1-1.575-.987L8.473 8.89a.25.25 0 0 0-.225-.141H5a.75.75 0 0 1 0-1.5h3.248c.671 0 1.283.383 1.575.987l3.329 6.872a.25.25 0 0 0 .225.141h3.812l-.72-.72a.75.75 0 1 1 1.061-1.06l2 2a.75.75 0 0 1 0 1.06l-2 2a.75.75 0 0 1-1.06 0" />
  //     </svg>
  //   `)),
  //   quantize: $.unwrap(() => fromSvg(/*html*/`
  //     <svg xmlns="http://www.w3.org/2000/svg" height="36" width="36" viewBox="0 0 256 256">
  //       <path fill="currentColor" d="M252 56a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12H84v36a12 12 0 0 1-12 12H16a12 12 0 0 1 0-24h44v-36a12 12 0 0 1 12-12h44v-36a12 12 0 0 1 12-12h44V56a12 12 0 0 1 12-12h56a12 12 0 0 1 12 12" />
  //     </svg>
  //   `)),
  //   duplicate: $.unwrap(() => fromSvg(/*html*/`
  //     <svg xmlns="http://www.w3.org/2000/svg" height="48" width="48" viewBox="0 0 32 32">
  //       <rect fill="currentColor" x="6" y="8" height="8" width="8" />
  //       <rect fill="currentColor" x="22" y="8" height="8" width="8" />
  //       <path stroke="currentColor" d="M 6 12 L 22 12" />
  //     </svg>
  //   `)),
  // })

  // $.fx(() => {
  //   const { snap, beat, shuffle, quantize } = $.of(icons)
  //   $()
  //   surface.anim.info.epoch++
  // })

  const tick = () => {
    c.restore()
    c.save()

    r.clear(c)

    if (!grid || !surface) return
    const m = surface.viewMatrix
    // c.translate(-selfView.x * state.pr, 0)

    // c.scale(state.pr, state.pr)

    const { pr } = state

    c.fillStyle = '#fff'
    c.translate(0, surface.canvas.offsetTop * pr)

    r.setParameters(0, 0, 110, window.innerHeight * pr)

    for (const track of state.tracks) {
      let y = track.info.y * m.d * pr + m.f * pr
      const w = 55 * pr
      let h = 1 * m.d * pr
      if (y < 0) {
        h += y
        y = 0
      }
      c.fillRect(0, y, w, h - pr)
    }

    c.restore()
    c.save()
  }

  $.fx(() => {
    surface.anim.ticks.add(tick)
    return () => {
      surface.anim.ticks.delete(tick)
    }
  })

  return { hitArea }
}
