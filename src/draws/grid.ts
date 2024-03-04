import { Signal, type $ } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { MouseButton, MouseButtons, clamp, debounce, dom } from 'utils'
import { ShapeOpts } from '../../as/assembly/gfx/sketch-shared.ts'
import { Audio } from '../audio.ts'
import { CODE_WIDTH } from '../constants.ts'
import { Track, TrackBox, TrackBoxKind } from '../dsp/track.ts'
import { Shapes, type Shape } from '../gl/sketch.ts'
import { log, state } from '../state.ts'
import { Surface } from '../surface.ts'
import { lerpMatrix, transformMatrixRect } from '../util/geometry.ts'
import { BLACK_KEYS, MAX_NOTE, Note, byNoteN, getNotesScale } from '../util/notes.ts'

const DEBUG = true
const SCALE_X = 1 / 16
const NOTES_HEIGHT_NORMAL = 0.65
const WAVES_HEIGHT_NORMAL = 1 - NOTES_HEIGHT_NORMAL
const WAVES_MARGIN_NORMAL = 0.0775
const OFFSCREEN_X = -100_000

export type Grid = ReturnType<typeof Grid>

export function Grid(surface: Surface, audio: Audio) {
  using $ = Signal()

  const { anim, mouse, keyboard, view, intentMatrix, viewMatrix, sketch } = surface
  const { dsp, player } = audio
  const { lastFarMatrix, targetMatrix, tracks } = state

  sketch.scene.clear()

  const targetView = $(new Rect)
  $.fx(() => {
    const { mode } = state
    const { w, h } = view
    $()
    targetView.set(view)
    if (mode === 'edit' || mode === 'dev') {
      targetView.x += CODE_WIDTH + 55
      targetView.w -= CODE_WIDTH + 55
    }
  })

  const brushes = new Map<Track, GridBox>()

  const info = $({
    redraw: 0,

    boxes: null as null | ReturnType<typeof Boxes>,
    focusedBox: null as null | GridBox,
    hoveringBox: null as null | GridBox,
    hoveringNoteN: -1,
    hoveringNote: null as null | Note,
    draggingNote: null as null | Note,
  })
  const gridInfo = info

  let pianoroll: ReturnType<typeof Pianoroll> | undefined

  info.boxes = Boxes(tracks)

  function getInitialMatrixValues() {
    const boxes = info.boxes
    if (!boxes) return
    const a = Math.max(7.27, targetView.w / boxes.info.width, 1)
    const d = targetView.h / Math.max(3, tracks.length)
    const e = (state.mode === 'wide' ? 0 : CODE_WIDTH + 57) - boxes.info.left * a
    const f = 0
    return { a, d, e, f }
  }

  $.untrack(function initial_scale() {
    if (intentMatrix.a === 1) {
      const m = getInitialMatrixValues()
      if (!m) return
      viewMatrix.a = intentMatrix.a = m.a
      viewMatrix.d = intentMatrix.d = m.d
      viewMatrix.e = intentMatrix.e = m.e

      // lastFarMatrix.set(viewMatrix)
      $.fx(function scale_rows_to_fit_height() {
        const { h } = targetView
        const { tracks } = state
        $()
        intentMatrix.d = h / Math.max(3, tracks.length)
      })
    }
  })

  //
  // interaction
  //

  let isWheelHoriz = false
  let isZooming = false

  const p = { x: 0, y: 0 }
  const s = { x: 0, y: 0 }
  const r = { x: 0, y: 0, w: 0, h: 0 }
  let mousePos = { x: window.innerWidth, y: 0 }
  mouse.pos.x = mousePos.x
  // let hoveringBox: BoxData | null

  const snap = { x: false, y: false }
  const lockedZoom = { x: false, y: false }
  $.fx(function apply_wasm_matrix() {
    const { a, b, c, d, e, f } = intentMatrix
    const { hoveringBox } = info
    const { mode } = state
    $()
    lockedZoom.x = false
    lockedZoom.y = false

    const m = viewMatrix.dest
    m.set(intentMatrix)
    // log('m.e', -info.boxes.right * m.a + mouse.pos.x, mouse.pos.x, m.e)
    // m.e = clamp(-(info.boxes!.info.right * m.a - view.w), mode === 'wide' ? 0 : CODE_WIDTH + 55, m.e)
    intentMatrix.a = m.a
    intentMatrix.e = m.e
    // log('m.e', m.e)

    if (hoveringBox) {
      const { rect } = hoveringBox
      if (snap.y && snap.x) {
        transformMatrixRect(m, rect, r)
        if (r.x < 0) {
          m.e -= r.x
        }
        transformMatrixRect(m, rect, r)
        if (r.x + r.w > view.w) {
          m.e -= r.x + r.w - view.w
          transformMatrixRect(m, rect, r)
          if (r.x < 0) {
            m.a = (view.w / rect.w)
            m.e = -rect.x * m.a
            lockedZoom.x = true
          }
        }
      }

      if (snap.y) {
        transformMatrixRect(m, rect, r)
        if (r.y < 0) {
          m.f -= r.y
        }
        transformMatrixRect(m, rect, r)
        if (r.y + r.h > view.h) {
          m.f -= r.y + r.h - view.h
          transformMatrixRect(m, rect, r)
          if (r.y < 0) {
            m.d = (view.h / rect.h)
            m.f = -rect.y * m.d
            lockedZoom.y = true
          }
        }
      }
    }
  })

  function handleWheelScaleY(e: WheelEvent) {
    const { x, y } = mousePos

    const m = intentMatrix
    const d = m.d
    const delta = -e.deltaY * 0.0035
    if (lockedZoom.y && delta > 0) return
    const delta_d = (d + (delta * d ** 0.9)) / d

    m.translate(x, y).scale(1, delta_d)
    m.d = clamp(0.01, 2000, m.d)
    m.translate(-x, -y)
  }

  function handleWheelScaleX(ev: WheelEvent) {
    let { x, y } = mousePos
    const minZoomX = view.w / Math.max(view.w, info.boxes!.info.width)
    const maxZoomX = 64000

    const m = intentMatrix
    const { a, e, f } = m
    const delta = -ev.deltaY * 0.0035
    if (lockedZoom.x && delta > 0) return

    let delta_a = (a + (delta * a ** 0.9)) / a
    const new_a = a * delta_a
    const clamped_a = clamp(minZoomX, maxZoomX, new_a)
    if (clamped_a !== new_a) {
      delta_a = clamped_a / a
      if (delta_a === 1) return
    }

    x = Math.max(0, x)
    m.translate(x, y)
    m.scale(delta_a, 1)
    m.translate(-x, -y)
  }

  function unhoverBox() {
    if (info.draggingNote) return
    const { hoveringBox } = info
    if (hoveringBox) {
      info.hoveringBox = null
    }
  }

  let brush: GridBox | null | undefined

  function updateHoveringBox(box?: GridBox | null) {
    if (info.draggingNote) return

    if (box) {
      const { hoveringBox } = info
      // TODO: no need for rect check, only reference?
      if (!hoveringBox || hoveringBox.rect.x !== box.rect.x || hoveringBox.rect.y !== box.rect.y) {
        info.hoveringBox = box
      }
      if (brush) {
        brush.rect.x = OFFSCREEN_X
        brush = null
      }
    }
    else {
      unhoverBox()

      let { x, y } = mouse.screenPos
      x = Math.floor(x)
      y = Math.floor(y)
      const track = state.tracks[y]
      const lastBrush = brush
      brush = brushes.get(track)
      if (brush) {
        brush.rect.x = x
        info.hoveringBox = brush
      }
      if (lastBrush && lastBrush !== brush) {
        lastBrush.rect.x = OFFSCREEN_X
      }
    }
  }

  function handleHoveringBox(force?: boolean) {
    if (state.isHoveringHeads) return
    // if (state.isHoveringToolbar) return
    if (info.draggingNote) return

    let { x, y } = mouse.screenPos
    x = Math.floor(x)
    y = Math.floor(y)

    if (!isZooming || force) {
      const box = info.boxes!.hitmap.get(`${x}:${y}`)
      updateHoveringBox(box)
    }
  }

  $.fx(() => {
    const { a, b, c, d, e, f } = viewMatrix
    $()
    handleHoveringBox()
  })

  const notePos = { x: -1, y: -1 }

  function updateHoveringNoteN() {
    const { hoveringBox } = info
    if (hoveringBox?.trackBox?.kind !== TrackBoxKind.Notes || !hoveringBox?.info.notes) return

    let { x, y } = mouse.screenPos
    x -= hoveringBox.rect.x
    y = (y - hoveringBox.rect.y) * (1 / NOTES_HEIGHT_NORMAL)
    notePos.x = x * 16
    notePos.y = y

    const { notes } = hoveringBox.info

    info.hoveringNoteN = clamp(
      0,
      MAX_NOTE - 1,
      Math.ceil(
        notes.info.scale.max - 1
        - (y * notes.info.scale.N)
      )
    )
  }

  function handleHoveringNote() {
    if (!info.focusedBox) return
    if (info.hoveringBox !== info.focusedBox) return
    if (info.hoveringBox?.trackBox.kind !== TrackBoxKind.Notes) return
    if (info.draggingNote) return

    const { notes } = info.hoveringBox.trackBox.track.info

    updateHoveringNoteN()
    const hn = info.hoveringNoteN
    const { x, y } = notePos

    if (isZooming) {
      info.hoveringNote = null
      return
    }

    let found = false
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i]
      const { n, time, length } = note
      if (n !== hn) continue
      if (x >= time && x <= time + length) {
        info.hoveringNote = note
        found = true
        break
      }
    }
    if (!found) {
      info.hoveringNote = null
    }

    log('hover note', hn, x, y)
  }

  function handleWheelZoom(e: WheelEvent) {
    if (e.deltaY > 0) {
      if (state.zoomState === 'zooming') {
        viewMatrix.speed = ZOOM_SPEED_NORMAL
        log(intentMatrix.d)
        if (intentMatrix.d < 100) {
          if (!info.draggingNote) {
            if (info.focusedBox) {
              info.hoveringBox = info.focusedBox
            }
            info.focusedBox = null
          }
        }
        const amt = Math.min(.5, Math.abs(
          e.deltaY / ((viewMatrix.a * 0.008) ** 0.82)
          * ((targetMatrix.a * 0.05) ** 1.15) * .85) * .0001
        )
        lerpMatrix(intentMatrix, lastFarMatrix, amt)
        if (Matrix.compare(intentMatrix, lastFarMatrix, 30.0)) {
          zoomFar()
        }
      }
    }
    else {
      if (state.zoomState === 'far') {
        state.zoomState = 'zooming'
        lastFarMatrix.set(intentMatrix)
      }
      if (state.zoomState === 'zooming') {
        if (!info.hoveringBox) return
        if (!info.draggingNote) {
          if (intentMatrix.d > 150) {
            info.focusedBox = info.hoveringBox
          }
        }
        const amt = Math.min(.5, Math.abs(
          e.deltaY * ((viewMatrix.a * 0.008) ** 0.92)
          / ((targetMatrix.a * 0.05) ** 0.5) * .85) * .0028)
        lerpMatrix(intentMatrix, targetMatrix, amt)
      }
    }
  }

  function handleDraggingNoteMove() {
    if (!info.draggingNote) return

    updateHoveringNoteN()
    info.draggingNote.n = info.hoveringNoteN
  }

  function updateMousePos() {
    const { x, y } = mouse.screenPos
    mousePos.x = x
    mousePos.y = y
  }

  // DEBUG && $.fx(() => {
  //   const { zoomState } = state
  //   $()
  //   log('zoomState', zoomState)
  // })

  // DEBUG && $.fx(() => {
  //   const { a } = viewMatrix
  //   $()
  //   log('m.a', a)
  // })

  const ZOOM_SPEED_SLOW = 0.2
  const ZOOM_SPEED_NORMAL = 0.3

  $.fx(function update_zoom_speed() {
    const { isRunning } = viewMatrix
    $()
    if (!isRunning) {
      if (viewMatrix.speed === ZOOM_SPEED_SLOW) {
        viewMatrix.speed = ZOOM_SPEED_NORMAL
      }
    }
  })

  const pianoWidth = 65 / view.w

  function applyBoxMatrix(m: Matrix, box: GridBox) {
    const { rect, trackBox: { kind } } = box
    const isNotes = kind === TrackBoxKind.Notes
    const w = isNotes ? rect.w + pianoWidth * 2 : rect.w
    const ox = isNotes ? pianoWidth : 0
    const padY = .082
    const padX = 0 //10
    Matrix.viewBox(m, targetView, {
      x: rect.x - ox, // - w / (padX * 2) - ox,
      y: rect.y - padY,
      w: w - ox, // + w / padX,
      h: rect.h + padY * 2,
    })
  }

  const zoomBox = $.fn(function zoomBox(box: GridBox) {
    isWheelHoriz = false
    state.zoomState = 'zooming'
    viewMatrix.isRunning = true
    viewMatrix.speed = ZOOM_SPEED_SLOW
    applyBoxMatrix(intentMatrix, box)
  })

  const zoomFull = $.fn(function zoomFull() {
    isWheelHoriz = false
    state.zoomState = 'zooming'
    viewMatrix.isRunning = true
    viewMatrix.speed = ZOOM_SPEED_SLOW
    const m = getInitialMatrixValues()
    if (!m) return
    intentMatrix.a = m.a
    intentMatrix.d = m.d
    intentMatrix.e = m.e
    intentMatrix.f = m.f
    lastFarMatrix.set(intentMatrix)
  })

  const zoomFar = $.fn(function zoomFar() {
    if (!info.draggingNote) {
      info.focusedBox = null
    }
    viewMatrix.speed = ZOOM_SPEED_NORMAL
    state.zoomState = 'far'
    intentMatrix.set(lastFarMatrix)
  })

  keyboard.targets.add(ev => {
    if (ev.type === 'keydown') {
      log(ev.key)
      if (ev.key === 'Escape') {
        zoomFull()
      }
    }
  })

  //
  // mouse
  //

  let orientChangeScore = 0
  let clicks = 0
  const CLICK_MS = 300
  const debounceClearClicks = debounce(CLICK_MS, () => {
    if (clicks === 1) {
      info.focusedBox = info.hoveringBox
    }
    clicks = 0
  })

  mouse.targets.add(ev => {
    // if (ev.type !== 'wheel' && state.isHoveringToolbar) return

    // clear the clicks when mouse is moved
    if (ev.type !== 'mousedown' && ev.type !== 'mouseup') {
      clicks = 0
    }

    isZooming = false
    if (ev.type === 'mouseout' || ev.type === 'mouseleave') {
      // unhoverBox()
      return
    }
    else if (ev.type === 'mousedown') {
      updateMousePos()
      debounceClearClicks()
      if (info.hoveringBox) {
        if (ev.buttons & MouseButtons.Right) {
          info.hoveringBox.trackBox.track.removeBox(
            info.hoveringBox.trackBox
          )
          $.flush()
          // return
        }
        else {
          ++clicks
          if (info.hoveringBox?.dimmed) {
            info.hoveringBox.trackBox.track.addBox(
              info.hoveringBox.trackBox.source,
              $({
                ...info.hoveringBox.trackBox.data,
                time: info.hoveringBox.rect.x
              }),
            )
            clicks = 0
            $.flush()
          }
          else if (clicks >= 2) {
            if (state.zoomState === 'far') {
              lastFarMatrix.set(intentMatrix)
            }
            info.focusedBox = info.hoveringBox
            zoomBox(info.hoveringBox)
            return
          }
          else if (info.hoveringNote) {
            info.draggingNote = info.hoveringNote
            dom.on(window, 'mouseup', $.fn((e: MouseEvent): void => {
              info.hoveringNote = null
              info.draggingNote = null
              handleHoveringNote()
            }), { once: true })
            return
          }
        }
      }
      else {
        if (++clicks >= 2) {
          zoomFull()
        }
      }
    }
    else if (ev.type === 'mousemove' || ev.type === 'mouseenter') {
      updateMousePos()
      if (info.draggingNote) {
        handleDraggingNoteMove()
        return
      }
    }
    else if (ev.type === 'wheel') {
      const e = ev as WheelEvent

      mouse.matrix = intentMatrix

      const isHoriz =
        Math.abs(e.deltaX) * (isWheelHoriz ? 3 : 3) >
        Math.abs(e.deltaY) * (isWheelHoriz ? .5 : 1)

      if (isHoriz !== isWheelHoriz) {
        if (orientChangeScore++ > (isWheelHoriz ? 3 : 2)) {
          orientChangeScore = 0
          updateMousePos()
          isWheelHoriz = isHoriz
        }
        else {
          return
        }
      }
      else {
        orientChangeScore = 0
      }

      if (isHoriz || e.altKey) {
        mouse.matrix = viewMatrix
        const de = (e.deltaX - (e.altKey ? e.deltaY : 0)) * 2.5 * 0.08 * (intentMatrix.a ** 0.18)
        intentMatrix.e -= de
      }
      else {
        if (e.ctrlKey) {
          updateMousePos()
          handleWheelScaleX(e)
        }
        else {
          isZooming = true
          handleWheelZoom(e)
        }
      }
    }

    if (info.draggingNote) return

    handleHoveringBox()
    handleHoveringNote()
  })

  //
  // drawings
  //

  type GridBox = ReturnType<typeof GridBox>
  type GridNotes = ReturnType<typeof Notes>

  function GridBox(boxes: Shapes, waveformShapes: Shapes, trackBox: TrackBox, dimmed: boolean = false) {
    using $ = Signal()

    const info = $({
      trackBox,
      notes: null as null | GridNotes,
    })

    const { rect } = trackBox

    const box = boxes.Box(rect)
    const alpha = dimmed ? 0.25 : 1.0
    box.view.alpha = alpha

    let waveformBg: ReturnType<Shapes['Wave']>
    let waveform: ReturnType<Shapes['Wave']>

    function remove() {
      box.remove()
      if (info.notes) sketch.scene.delete(info.notes.shapes)
      if (waveformBg) waveformBg.remove()
      if (waveform) waveform.remove()
      pianoroll?.hide()
      $.dispose()
    }

    if (!dimmed) $.fx(() => {
      const { track, isFocused, isHovering } = trackBox
      const color = isFocused || isHovering
        ? track.info.colors.bgHover
        : track.info.colors.bg
      $()
      box.view.color = color
      redraw(boxes)
    })

    $.fx(() => {
      const { kind } = trackBox
      $()
      if (kind === TrackBoxKind.Notes) {
        const notes = info.notes = Notes(trackBox, dimmed)
        sketch.scene.add(notes.shapes)
        redraw(notes.shapes)

        waveformBg = waveformShapes.Wave($({
          get x() { return rect.x },
          get y() { return 0.01 + rect.y + rect.h * NOTES_HEIGHT_NORMAL + rect.h * WAVES_MARGIN_NORMAL * 0.5 },
          get w() { return rect.w },
          get h() { return rect.h * WAVES_HEIGHT_NORMAL - rect.h * WAVES_MARGIN_NORMAL },
        }))
        waveformBg.view.alpha = 0.6 * alpha

        waveform = waveformShapes.Wave($({
          get x() { return rect.x },
          get y() { return rect.y + rect.h * NOTES_HEIGHT_NORMAL + rect.h * WAVES_MARGIN_NORMAL * 0.5 },
          get w() { return rect.w },
          get h() { return rect.h * WAVES_HEIGHT_NORMAL - rect.h * WAVES_MARGIN_NORMAL },
        }))
        waveform.view.alpha = alpha

        const off = $.fx(() => {
          const { isFocused } = trackBox
          $()
          if (isFocused && !dimmed) {
            pianoroll ??= Pianoroll(trackBox)
            pianoroll.info.trackBox = trackBox
            pianoroll.hide()
            pianoroll.show()
            toFront(notes.shapes)
            toFront(waveformShapes)
            redraw()
          }
        })

        return [() => {
          sketch.scene.delete(notes.shapes)
          off()
        }, $.fx(() => {
          const { track, isFocused } = trackBox
          const { floats, colors } = $.of(track.info)
          $()

          waveformBg.visible = Boolean(isFocused && !dimmed)
          waveformBg.view.floats$ = floats.ptr
          waveformBg.view.len = floats.len
          waveformBg.view.coeff = dsp.clock.coeff

          waveform.view.color = isFocused && !dimmed ? colors.colorBright : colors.fg
          waveform.view.floats$ = floats.ptr
          waveform.view.len = floats.len
          waveform.view.coeff = dsp.clock.coeff

          redraw(waveformShapes)
        })]
      }
      else if (kind === TrackBoxKind.Audio) {
        waveformBg = waveformShapes.Wave($({
          get x() { return rect.x },
          get y() { return rect.y + (rect.h - rect.hh) / 2 },
          get w() { return rect.w },
          get h() { return rect.hh },
        }))
        waveformBg.view.alpha = 0.6 * alpha

        waveform = waveformShapes.Wave($({
          get x() { return rect.x },
          get y() { return rect.y + (rect.h - rect.hh) / 2 },
          get w() { return rect.w },
          get h() { return rect.hh },
        }))
        waveform.view.alpha = alpha

        return $.fx(() => {
          const { track, isFocused } = trackBox
          const { floats, colors } = $.of(track.info)
          $()

          waveformBg.visible = Boolean(isFocused && !dimmed)
          waveformBg.view.floats$ = floats.ptr
          waveformBg.view.len = floats.len
          waveformBg.view.coeff = dsp.clock.coeff

          waveform.view.color = isFocused && !dimmed ? colors.colorBright : colors.fg
          waveform.view.floats$ = floats.ptr
          waveform.view.len = floats.len
          waveform.view.coeff = dsp.clock.coeff

          redraw(waveformShapes)
        })
      }
    })

    return { rect, trackBox, info, box, dimmed, remove }
  }

  function toFront(shapes: Shapes) {
    sketch.scene.delete(shapes)
    sketch.scene.add(shapes)
  }

  function Boxes(tracks: Track[]) {
    using $ = Signal()

    const hitmap = new Map<string, GridBox>()

    const shapes = Shapes(view, viewMatrix)
    const waveformShapes = Shapes(view, viewMatrix)

    $.fx(() => {
      sketch.scene.add(shapes)
      sketch.scene.add(waveformShapes)
      return () => {
        sketch.scene.delete(shapes)
        sketch.scene.delete(waveformShapes)
      }
    })

    const info = $({
      rows: [] as GridBox[][],
      get width() {
        return this.right - this.left
      },
      get left() {
        return this.rows.flat().reduce((p, n) =>
          n.rect.left < p
            ? n.rect.left
            : p,
          this.right
        )
      },
      get right() {
        return this.rows.flat().reduce((p, n) =>
          n.rect.right > p
            ? n.rect.right
            : p,
          0
        )
      },
    })

    const gridBoxMap = new Map<TrackBox, GridBox>()

    $.fx(() => {
      const prevTrackBoxes = new Map<TrackBox, GridBox>(gridBoxMap)
      const currTrackBoxes = new Set<TrackBox>()

      info.rows = Array.from(tracks).map(track => {
        const gridBoxes: GridBox[] = []

        for (const box of track.info.boxes) {
          let gridBox = gridBoxMap.get(box)
          if (!gridBox) gridBoxMap.set(
            box,
            gridBox = GridBox(shapes, waveformShapes, box)
          )
          currTrackBoxes.add(box)
          gridBoxes.push(gridBox)
        }

        if (!brushes.get(track)) $.untrack(() => {
          const proto = { track }
          const templateBox = track.info.boxes[0]
          const brushBox = $({
            __proto__: proto,
            data: templateBox.data,
            kind: templateBox.kind,
            rect: $(new Rect, { x: OFFSCREEN_X, y: templateBox.rect.y, w: templateBox.rect.w, h: 1 }),
            source: templateBox.source,
            isFocused: false,
            isHovering: false,
          }) as $<TrackBox & { __proto__: typeof proto }>

          brushes.set(track, GridBox(shapes, waveformShapes, brushBox, true))
        })

        return gridBoxes
      })

      for (const [box, gridBox] of prevTrackBoxes) {
        if (!currTrackBoxes.has(box)) {
          gridBoxMap.delete(box)
          gridBox.remove()
        }
      }

      $()

      redraw(shapes)
    })

    $.fx(() => {
      const { rows } = info
      $()
      hitmap.clear()
      for (const row of rows) {
        for (const gridBox of row) {
          const { left, y, right } = gridBox.rect
          for (let x = left; x < right; x++) {
            hitmap.set(`${x}:${y}`, gridBox)
          }
        }
      }
    })

    return { info, hitmap, shapes, $ }
  }

  function Pianoroll(trackBox: TrackBox) {
    using $ = Signal()

    const SNAPS = 16
    const PIANO_WIDTH = .065

    const info = $({
      trackBox,
      get scale() {
        return getNotesScale(this.trackBox.track.info.notes)
      },
    })

    const rect = $(new Rect)
    const rectCols = $(new Rect)

    const pianoroll = Shapes(view, viewMatrix)

    const pianorollBg = pianoroll.Box(rect)
    $.fx(() => {
      const { trackBox } = info
      pianorollBg.view.color = trackBox.track.info.colors.bgHover
    })

    pianoroll.Box($({
      get x() { return rect.x - PIANO_WIDTH },
      get y() { return rect.y },
      get w() { return PIANO_WIDTH },
      get h() { return rect.h },
    }))

    $.fx(() => {
      const { x, y, w, h } = info.trackBox.rect
      $()
      rect.setParameters(x, y, w, h * NOTES_HEIGHT_NORMAL)
      pianoroll.update()
    })

    $.fx(() => {
      const { x, y, w, h } = info.trackBox.rect
      $()
      rectCols.setParameters(x, y, w, h)
      pianoroll.update()
    })

    const rows = Shapes(view, viewMatrix)

    $.fx(() => {
      const { scale } = info
      const { x: cx, y: cy, w: cw, h: ch } = rect
      const { colors } = trackBox.track.info
      $()
      rows.clear()
      const h = rect.h / scale.N
      for (let ny = 0; ny < scale.N; ny++) {
        const y = rect.y + h * ny
        const n = scale.N - ny - 1 + scale.min
        const n_key = n % 12

        const isBlack = BLACK_KEYS.has(n_key)

        if (isBlack) {
          const row = rows.Box({
            x: cx,
            y,
            w: cw,
            h,
          })
          row.view.opts = ShapeOpts.Box | ShapeOpts.NoMargin
          row.view.alpha = .25
        }

        const key = rows.Box({
          get x() { return rect.x - this.w },
          y,
          w: PIANO_WIDTH,
          h,
        })
        key.view.color = isBlack ? 0x0 : 0xffffff
      }
      // const waveBgOuter = rows.Box({
      //   x: cx,
      //   y: rectCols.y + rectCols.h * NOTES_HEIGHT_NORMAL,
      //   w: cw,
      //   h: rectCols.h * WAVES_HEIGHT_NORMAL,
      // })
      // waveBgOuter.view.color = colors.bg
      // // waveBgOuter.view.opts = ShapeOpts.Box | ShapeOpts.NoMargin
      // waveBgOuter.view.alpha = 1.0

      // const waveBg = rows.Box({
      //   x: cx,
      //   y: rectCols.y + rectCols.h * NOTES_HEIGHT_NORMAL
      //     + rectCols.h * WAVES_MARGIN_NORMAL * 0.5,
      //   w: cw,
      //   h: rectCols.h * WAVES_HEIGHT_NORMAL - rectCols.h * WAVES_MARGIN_NORMAL,
      // })
      // waveBg.view.color = colors.bgHover
      // waveBg.view.opts = ShapeOpts.Box | ShapeOpts.NoMargin
      // waveBg.view.alpha = 1.0

      rows.update()
    })

    const cols = Shapes(view, viewMatrix)

    $.fx(() => {
      const { x: cx, y: cy, w: cw, h: ch } = info.trackBox.rect
      $()
      cols.clear()
      const cols_n = (cw * SNAPS) - 1
      for (let col = 0; col < cols_n; col++) {
        const x = ((1 + col) / SNAPS) + cx
        const p0 = $({ x, y: info.trackBox.rect.$.y })
        const p1 = $({ x, y: info.trackBox.rect.$.bottom })
        const line = cols.Line(p0, p1)
        line.view.lw = col % 16 === 15 ? 1.5 : col % 4 === 3 ? 1 : 0.5
      }
      cols.Line({
        x: cx,
        y: cy + ch * NOTES_HEIGHT_NORMAL
      }, {
        x: cx + cw,
        y: cy + ch * NOTES_HEIGHT_NORMAL
      })
      cols.update()
    })

    function show() {
      sketch.scene.add(pianoroll)
      sketch.scene.add(rows)
      sketch.scene.add(cols)
    }

    function hide() {
      sketch.scene.delete(pianoroll)
      sketch.scene.delete(rows)
      sketch.scene.delete(cols)
    }

    return { info, show, hide }
  }

  function Notes(trackBox: TrackBox, dimmed: boolean = false) {
    using $ = Signal()

    const shapes = Shapes(view, viewMatrix)

    const info = $({
      trackBox,
      get scale() {
        return getNotesScale(this.trackBox.track.info.notes)
      },
      update: 0,
    })

    const r = trackBox.rect

    const rect = $({
      get x() { return r.x },
      get y() { return r.y },
      get w() { return r.w },
      get h() { return r.h * NOTES_HEIGHT_NORMAL },
    })

    const notesShape = shapes.Notes(rect)
    notesShape.view.alpha = dimmed ? 0.5 : 1.0
    $.fx(() => {
      const { track, isFocused } = trackBox
      const { colors } = track.info
      // const { primaryColorInt } = state
      $()
      notesShape.view.color = isFocused && !dimmed ? colors.colorBright : colors.fg
    })

    $.fx(() => {
      const { scale } = info
      const { notesData } = trackBox.track.info
      $()
      notesShape.view.notes$ = notesData.ptr
      notesShape.view.min = scale.min
      notesShape.view.max = scale.max
    })

    $.fx(() => {
      const { isFocused } = trackBox
      $()
      notesShape.view.isFocused = Number(Boolean(isFocused))
    })

    // const map = new Map<
    //   Note,
    //   {
    //     noteBg: ReturnType<typeof shapes.Box>,
    //     noteShape: ReturnType<typeof shapes.Box>
    //   }
    // >()

    // const getAlpha = (vel: number, isFocused?: boolean, isHoveringNote?: boolean) =>
    //   (isFocused
    //     ? isHoveringNote
    //       ? 1
    //       : .45 + (.55 * vel)
    //     : .2 + (.8 * vel)) * (dimmed ? 0.2 : 1.0)

    // $.fx(() => {
    //   const { scale } = info
    //   const { track, rect } = trackBox
    //   const { x: cx, y: cy, w: cw } = rect
    //   const ch = rect.h * NOTES_HEIGHT_NORMAL
    //   const { notes } = track.info
    //   $()
    //   shapes.clear()
    //   map.clear()
    //   notes.sort(byNoteN).forEach(note => {
    //     const { n, time, length, vel } = note

    //     const x = time * SCALE_X // x
    //     if (x >= cw) return

    //     const h = ch / scale.N
    //     const y = ch - h * (n + 1 - scale.min) // y

    //     let w = length * SCALE_X // w
    //     if (x + w > cw) {
    //       w = cw - x
    //     }

    //     const noteBg = shapes.Box({
    //       x: cx + x,
    //       y: cy + y,
    //       w,
    //       h: h + .0065,
    //     })
    //     noteBg.view.opts = ShapeOpts.Box | ShapeOpts.Collapse
    //     noteBg.visible = false

    //     const noteShape = shapes.Box({
    //       x: cx + x,
    //       y: cy + y,
    //       w,
    //       h,
    //     })
    //     noteShape.view.opts = ShapeOpts.Box | ShapeOpts.Collapse

    //     map.set(note, { noteBg, noteShape })
    //   })
    //   shapes.update()
    //   info.update++
    // })

    // $.fx(() => {
    //   const { isFocused, track } = trackBox
    //   const { colors } = track.info
    //   const { primaryColorInt } = state
    //   const { update } = info
    //   $()
    //   if (isFocused && !dimmed) {
    //     const noteColor = colors.colorBright

    //     map.forEach(({ noteBg, noteShape }, note) => {
    //       noteBg.visible = true
    //       noteBg.view.alpha = noteShape.view.alpha = getAlpha(note.vel, true)
    //       noteShape.view.color = noteColor
    //     })
    //     redraw(shapes)

    //     return $.fx(() => {
    //       const { hoveringNote } = $.of(gridInfo)
    //       $()
    //       const noteShapes = map.get(hoveringNote)
    //       if (!noteShapes) return

    //       const { noteBg, noteShape } = noteShapes

    //       noteBg.view.alpha =
    //         noteShape.view.alpha =
    //         getAlpha(hoveringNote.vel, true, true)

    //       noteShape.view.color = primaryColorInt

    //       redraw(shapes)
    //       return () => {
    //         noteBg.view.alpha =
    //           noteShape.view.alpha =
    //           getAlpha(hoveringNote.vel, true, false)

    //         noteShape.view.color = noteColor
    //         redraw(shapes)
    //       }
    //     })
    //   }
    //   else {
    //     map.forEach(({ noteBg, noteShape }, note) => {
    //       noteBg.visible = false
    //       noteShape.view.alpha = getAlpha(note.vel)
    //       noteShape.view.color = colors.fg
    //     })
    //     redraw(shapes)
    //   }
    // })

    return { info, shapes }
  }

  const overlay = Shapes(view, viewMatrix)

  const rulerNow = overlay.Line(
    $({ x: audio.info.$.timeNowLerp, y: -10 }),
    $({ x: audio.info.$.timeNowLerp, get y() { return state.tracks.length + 10 } })
  )
  $.fx(() => {
    rulerNow.view.color = state.primaryColorInt
  })
  sketch.scene.add(overlay)
  overlay.update()

  $.fx(() => {
    const { timeNow } = audio.info
    $()
    redraw(overlay)
  })

  $.fx(() => {
    const { isPlaying } = player.info
    $()
    surface?.anim.ticks.add(audio.tick)
    audio.tick()
    info.redraw++
  })

  function redraw(shapes?: Shapes) {
    shapes?.update()
    info.redraw++
  }

  $.fx(function update_hovering_box_color() {
    const { hoveringBox } = $.of(info)
    $()
    applyBoxMatrix(targetMatrix, hoveringBox)
    hoveringBox.box.view.color = hoveringBox.trackBox.track.info.colors.bgHover
    return () => {
      hoveringBox.box.view.color = hoveringBox.trackBox.track.info.colors.bg
    }
  })

  $.fx(function update_box_isFocused() {
    const { focusedBox } = info
    if (!focusedBox) {
      $()
      pianoroll?.hide()
      redraw()
      return
    }
    const { trackBox } = focusedBox
    $()
    trackBox.isFocused = true
    return () => {
      trackBox.isFocused = false
    }
  })

  $.fx(function update_box_isHovering() {
    const { hoveringBox } = $.of(info)
    const { trackBox } = hoveringBox
    $()
    trackBox.isHovering = true
    return () => {
      trackBox.isHovering = false
    }
  })

  $.fx(function redraw() {
    const { redraw } = $.of(info)
    $()
    toFront(overlay)
    anim.info.epoch++
  })

  const grid = {
    info,
    view,
    mouse,
    mousePos,
    intentMatrix,
    lastFarMatrix,
    handleWheelZoom,
    handleWheelScaleX,
    updateHoveringBox,
  }

  return grid
}
