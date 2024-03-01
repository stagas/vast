import { Signal } from 'signal-jsx'
import { Point, Rect } from 'std'
import { dom, luminate } from 'utils'
import { Canvas } from '../comp/Canvas.tsx'
import { CODE_WIDTH } from '../constants.ts'
import { state } from '../state.ts'
import { Surface } from '../surface.ts'
import { fromSvg } from '../util/svg-to-image.ts'
import { Grid } from './grid.ts'
import { Track } from '../dsp/track.ts'

const DEBUG = true

export type Heads = ReturnType<typeof Heads>

export function Heads(c: CanvasRenderingContext2D, surface: Surface, grid: Grid, view: Rect) {
  using $ = Signal()

  const selfView = $(new Rect, { pr: state.$.pr }).set(view)
  const hitArea = $(new Rect)
  const r = $(new Rect)

  const mousePos = $(new Point)

  const info = $({
    hoveringTrack: null as Track | null,
  })

  function handleHover(e: MouseEvent | WheelEvent) {
    const { tracks, pr } = state
    mousePos.x = e.pageX * pr
    mousePos.y = e.pageY * pr
    mousePos.y -= 44 * pr

    r.set(hitArea)
    r.x += c.canvas.offsetLeft * pr
    r.y = 0
    r.h = (window.innerHeight - 44) * pr
    // r.zoomLinear(5)
    const last = tracks.at(-1)!
    if (mousePos.withinRect(r) && mousePos.y < last.info.sy + dims.h) {
      state.isHoveringHeads = true
      // e.stopImmediatePropagation()
      // e.preventDefault()

      for (const track of state.tracks) {
        if (mousePos.y > track.info.sy && mousePos.y < track.info.sy + dims.h) {
          info.hoveringTrack = track
          break
        }
      }

      if (info.hoveringTrack) {
        // grid.updateHoveringBox(info.hoveringTrack.info.boxes[0]?. ?? null)
      }

      dom.body.style.cursor = 'pointer'
    }
    else {
      dom.body.style.cursor = ''
      info.hoveringTrack = null
      state.isHoveringHeads = false
    }
    surface.anim.info.epoch++
  }

  $.fx(() => dom.on(window, 'mousemove', $.fn((e: MouseEvent) => {
    handleHover(e)
  }), { capture: true }))

  $.fx(() => dom.on(window, 'mousedown', $.fn((e: MouseEvent) => {
    const { hoveringTrack } = info
    if (hoveringTrack) {
      e.stopImmediatePropagation()
      e.preventDefault()
      hoveringTrack.play()
      dom.on(window, 'mouseup', e => {
        e.stopImmediatePropagation()
        e.preventDefault()
      }, { once: true })
    }
  }), { capture: true }))

  $.fx(() => {
    const { mode } = state
    $()
    selfView.set(view)
    if (mode === 'edit' || mode === 'dev') {
      selfView.w -= CODE_WIDTH
      selfView.x += CODE_WIDTH
    }
  })

  const icons = $({
    play: $.unwrap(() => fromSvg(/*html*/`
      <svg xmlns="http://www.w3.org/2000/svg" width="110" height="75" class="h-[20px] w-10" preserveAspectRatio="xMidYMid slice" viewBox="-10 -10 44 44">
        <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M7 17.259V6.741a1 1 0 0 1 1.504-.864l9.015 5.26a1 1 0 0 1 0 1.727l-9.015 5.259A1 1 0 0 1 7 17.259" />
      </svg>
    `, '#000', '#fff')),
    // stop: $.unwrap(() => fromSvg(/*html*/`
    //   <svg xmlns="http://www.w3.org/2000/svg" height="34" width="34" viewBox="0 0 24 24">
    //     <path fill="currentColor" d="M14 3v10.56c-.59-.35-1.27-.56-2-.56c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V3z" />
    //   </svg>
    // `)),
    // loop: $.unwrap(() => fromSvg(/*html*/`
    //   <svg xmlns="http://www.w3.org/2000/svg" height="47" width="47" viewBox="0 0 24 24">
    //     <path fill="currentColor" d="M16.47 5.47a.75.75 0 0 0 0 1.06l.72.72h-3.813a1.75 1.75 0 0 0-1.575.987l-.21.434a.4.4 0 0 0 0 .35l.568 1.174a.2.2 0 0 0 .36 0l.632-1.304a.25.25 0 0 1 .225-.141h3.812l-.72.72a.75.75 0 1 0 1.061 1.06l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-1.06 0m-6.436 9.859a.4.4 0 0 0 0-.35l-.57-1.174a.2.2 0 0 0-.36 0l-.63 1.304a.25.25 0 0 1-.226.141H5a.75.75 0 0 0 0 1.5h3.248a1.75 1.75 0 0 0 1.575-.987z" />
    //     <path fill="currentColor" d="M16.47 18.53a.75.75 0 0 1 0-1.06l.72-.72h-3.813a1.75 1.75 0 0 1-1.575-.987L8.473 8.89a.25.25 0 0 0-.225-.141H5a.75.75 0 0 1 0-1.5h3.248c.671 0 1.283.383 1.575.987l3.329 6.872a.25.25 0 0 0 .225.141h3.812l-.72-.72a.75.75 0 1 1 1.061-1.06l2 2a.75.75 0 0 1 0 1.06l-2 2a.75.75 0 0 1-1.06 0" />
    //   </svg>
    // `)),
    // solo: $.unwrap(() => fromSvg(/*html*/`
    //   <svg xmlns="http://www.w3.org/2000/svg" height="36" width="36" viewBox="0 0 256 256">
    //     <path fill="currentColor" d="M252 56a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12h-44v36a12 12 0 0 1-12 12H84v36a12 12 0 0 1-12 12H16a12 12 0 0 1 0-24h44v-36a12 12 0 0 1 12-12h44v-36a12 12 0 0 1 12-12h44V56a12 12 0 0 1 12-12h56a12 12 0 0 1 12 12" />
    //   </svg>
    // `)),
    // mute: $.unwrap(() => fromSvg(/*html*/`
    //   <svg xmlns="http://www.w3.org/2000/svg" height="48" width="48" viewBox="0 0 32 32">
    //     <rect fill="currentColor" x="6" y="8" height="8" width="8" />
    //     <rect fill="currentColor" x="22" y="8" height="8" width="8" />
    //     <path stroke="currentColor" d="M 6 12 L 22 12" />
    //   </svg>
    // `)),
  })

  $.fx(() => {
    const { play } = $.of(icons)
    // const { play, stop, loop, solo, mute } = $.of(icons)
    $()
    surface.anim.info.epoch++
  })

  const dims = $({
    get w() {
      return 55 * state.pr
    },
    get h() {
      return surface.viewMatrix.d * state.pr
    },
  })

  const tick = () => {
    c.restore()
    c.save()

    r.set(hitArea).clear(c)

    if (!grid || !surface) return

    const { pr } = state

    c.translate(0, surface.canvas.offsetTop * pr)

    hitArea.setParameters(0, 0, 110, window.innerHeight * pr)

    const { w, h } = dims

    for (const track of state.tracks) {
      let y = track.info.sy
      let th = h
      if (y + th < 0) continue
      if (y < 0) {
        th += y
        y = 0
      }
      c.save()
      c.beginPath()
      c.rect(0, y, w, th - pr)
      c.fillStyle =
        (info.hoveringTrack === track
          ? track.info.colors.hexColorBrighter
          : track.info.colors.hexColorBright) ?? '#fff'
      c.fill()
      c.clip()
      if (icons?.play) c.drawImage(
        // info.hoveringTrack === track
        //   ? icons.play.img_hover
        //   :
          icons.play.img
          , 0, y)
      c.restore()
      c.beginPath()
      c.moveTo(w, y)
      c.lineTo(w, y + th - pr)
      c.strokeStyle = '#000'
      c.lineWidth = pr * 2
      c.stroke()
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
