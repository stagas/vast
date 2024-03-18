import { Signal } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { MouseButtons, clamp, debounce, dom } from 'utils'
import { ShapeOpts } from '../../as/assembly/gfx/sketch-shared.ts'
import { Track, TrackBox } from '../dsp/track.ts'
import { Shapes } from '../gl/sketch.ts'
import { lib } from '../lib.ts'
import { screen } from '../screen.tsx'
import { services } from '../services.ts'
import { log, state } from '../state.ts'
import { Surface } from '../surface.ts'
import { transformMatrixRect } from '../util/geometry.ts'
import { BLACK_KEYS, BoxNote, MAX_NOTE, getNotesScale } from '../util/notes.ts'
import { HEADS_WIDTH } from '../constants.ts'

const DEBUG = true
const SCALE_X = 1 / 16
const NOTES_HEIGHT_NORMAL = 0.65
const WAVES_HEIGHT_NORMAL = 1 - NOTES_HEIGHT_NORMAL
const WAVES_MARGIN_NORMAL = 0.0775
const OFFSCREEN_X = -100_000
const RESIZE_HANDLE_WIDTH = 7

export enum ZoomState {
  In,
  Out,
}

export type Grid = ReturnType<typeof Grid>

export function Grid(surface: Surface) {
  using $ = Signal()

  const { anim, mouse, keyboard, view, intentMatrix, viewMatrix, sketch } = surface
  const { targetMatrix } = state

  sketch.scene.clear()

  const targetView = $(new Rect(view.size))

  const brushes = new Map<Track, GridBox>()

  const info = $({
    redraw: 0,

    hoverBoxMode: 'select' as 'select' | 'resize',
    hoveringBox: null as null | GridBox,
    resizingBox: null as null | GridBox,
    focusedBox: null as null | GridBox,

    hoveringNoteN: -1,
    hoveringNote: null as null | BoxNote,
    draggingNote: null as null | BoxNote,

    boxes: null as null | ReturnType<typeof Boxes>,
    get rowsCount() {
      return this.boxes?.info.rows.length ?? 1
    },
  })

  const max = 64000
  const limits = $({
    get x() {
      const min = !info.boxes ? view.w : view.w / Math.max(view.w, info.boxes.info.width)
      return { min, max }
    },
    get y() {
      const min = view.h / info.rowsCount
      return { min, max }
    },
  })

  const gridInfo = info

  let pianoroll: ReturnType<typeof Pianoroll> | undefined

  $.fx(() => {
    const { project } = $.of(lib)
    const { tracks } = project.info
    $()
    info.boxes = Boxes(tracks)
  })

  const OFFSET_X = 1
  function getInitialMatrixValues() {
    const boxes = info.boxes
    const left = boxes?.info.left || 0
    const width = boxes?.info.width || 1
    const height = lib.project!.info.tracks.length || 1
    const a = Math.max(7.27, targetView.w / width, 1)
    const d = targetView.h / height
    const e = OFFSET_X - left * a
    const f = 0
    return { a, d, e, f }
  }

  const offInitialScale = $.fx(function initial_scale() {
    const { project } = $.of(lib)
    const { boxes } = $.of(info)
    const { width } = boxes.info
    $()
    if (!width) return
    if (intentMatrix.a === 1) {
      const m = getInitialMatrixValues()
      viewMatrix.a = intentMatrix.a = m.a
      viewMatrix.d = intentMatrix.d = m.d
      viewMatrix.e = intentMatrix.e = m.e
    }
    queueMicrotask(() => offInitialScale())
  })

  //
  // interaction
  //

  let isWheelHoriz = false
  let isZooming = false

  const r = { x: 0, y: 0, w: 0, h: 0 }
  let mousePos = { x: window.innerWidth, y: 0 }
  mouse.pos.x = mousePos.x

  const snap = { x: true, y: true }
  // const lockedZoom = { x: false, y: false }
  let lastHoveringBox: GridBox | null = null
  $.fx(function apply_wasm_matrix() {
    const { a, b, c, d, e, f } = intentMatrix
    $()
    const { isPlaying } = services.audio.player.info
    const m = viewMatrix.dest
    m.set(intentMatrix)

    if (isPlaying) {
      snap.x = false
    }

    if (info.hoveringBox) {
      lastHoveringBox = info.hoveringBox
    }
    if (lastHoveringBox) {
      const { rect } = lastHoveringBox
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
          }
        }
      }
    }

    if (Math.ceil(m.f + m.d * info.rowsCount) < view.h) {
      m.f = 0
      m.d = limits.y.min
      intentMatrix.d = m.d
      intentMatrix.f = m.f
    }
    if (m.d < limits.y.min) {
      m.d = limits.y.min
      intentMatrix.d = m.d
    }
    if (m.f > 0) {
      m.f = 0
      intentMatrix.f = m.f
    }

    // if (isPlaying) {
    //   viewMatrix.set(m)
    // }
  })

  const scaleSpeed = 0.003

  function maybeScale(v: number, delta: number, limits: { min: number, max: number }) {
    let scale = (v + (delta * v ** 0.9)) / v
    const newScale = v * scale
    const clamped = clamp(limits.min, limits.max, newScale)
    if (clamped !== newScale) {
      scale = clamped / v
    }
    return scale
  }

  function handleWheelScaleY(ev: WheelEvent) {
    let { x, y } = mousePos

    const m = intentMatrix
    const { d } = m
    const delta = -ev.deltaY * scaleSpeed
    // if (lockedZoom.y && delta > 0) return

    const scale = maybeScale(d, delta, limits.y)
    if (scale === 1) return

    y = Math.max(0, y)
    m.translate(x, y)
    m.scale(1, scale)
    m.translate(-x, -y)
  }

  function handleWheelScaleX(ev: WheelEvent) {
    let { x, y } = mousePos

    const m = intentMatrix
    const { a } = m
    const delta = -ev.deltaY * scaleSpeed
    // if (lockedZoom.x && delta > 0) return

    const scale = maybeScale(a, delta, limits.x)
    if (scale === 1) return

    x = Math.max(0, x)
    m.translate(x, y)
    m.scale(scale, 1)
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

      if (!lib.project) return

      let { x, y } = mouse.screenPos
      x = Math.floor(x)
      y = Math.floor(y)
      const track = lib.project.info.tracks[y]
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
    if (!surface.info.isHovering) return

    let { x, y } = mouse.screenPos
    x = Math.floor(x)
    y = Math.floor(y)

    if (!isZooming || force) {
      const box = info.boxes?.hitmap.get(`${x}:${y}`)
      if (box && mouse.screenPos.x >=
        box.rect.right
        - (RESIZE_HANDLE_WIDTH / viewMatrix.a)
      ) {
        info.hoverBoxMode = 'resize'
      }
      else {
        info.hoverBoxMode = 'select'
      }
      updateHoveringBox(box)
    }
  }

  $.fx(() => {
    const { hoveringBox, hoverBoxMode } = info
    $()
    if (hoveringBox) {
      if (hoverBoxMode === 'resize') {
        screen.info.cursor = 'ew-resize'
      }
      else {
        screen.info.cursor = 'default'
      }
    }
    else {
      screen.info.cursor = 'default'
    }
  })

  $.fx(() => {
    const { a, b, c, d, e, f } = viewMatrix
    $()
    handleHoveringBox()
  })

  const notePos = { x: -1, y: -1 }

  function updateHoveringNoteN() {
    const { hoveringBox } = info
    if (!hoveringBox?.info.notes) {
      info.hoveringNoteN = -1
      return
    }

    let { x, y } = mouse.screenPos
    x -= hoveringBox.rect.x
    y = (y - hoveringBox.rect.y) * (1 / NOTES_HEIGHT_NORMAL)
    notePos.x = x * 16
    notePos.y = y

    const { notes } = hoveringBox.info
    if (!notes.info.scale) {
      info.hoveringNoteN = -1
      return
    }

    info.hoveringNoteN = clamp(
      0,
      MAX_NOTE - 1,
      Math.ceil(
        notes.info.scale.max
        - (y * (notes.info.scale.N + 1))
      )
    )
  }

  function handleHoveringNote() {
    if (!info.focusedBox) return
    if (info.hoveringBox !== info.focusedBox) {
      if (!info.hoveringBox || !info.draggingNote) {
        info.hoveringNoteN = -1
        info.hoveringNote = null
        return
      }
      if (info.hoveringBox?.trackBox.track === info.focusedBox.trackBox.track) {
        return
      }
    }
    // if (info.hoveringBox?.trackBox.kind !== TrackBoxKind.Notes) return
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
      const { n, time, length } = note.info
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

  const minScale = {
    x: 0.01,
    y: 0.01,
  }
  const maxScale = {
    x: 64000,
    y: 64000,
  }
  function handleZoom(e: WheelEvent) {
    updateMousePos()
    // console.log(intentMatrix.a, intentMatrix.d)
    handleWheelScaleX(e)
    if (intentMatrix.a > 400 || intentMatrix.d > limits.y.min) {
      handleWheelScaleY(e)
    }
  }

  function handleDraggingNoteMove() {
    if (!info.draggingNote) return

    updateHoveringNoteN()
    info.draggingNote.info.n = info.hoveringNoteN
  }

  function updateMousePos() {
    const { x, y } = mouse.screenPos
    mousePos.x = x
    mousePos.y = y
    $.flush()
  }

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

  function applyBoxMatrix(m: Matrix, box: GridBox) {
    Matrix.viewBox(m, targetView, box.rect)
  }

  const zoomBox = $.fn(function zoomBox(box: GridBox) {
    isWheelHoriz = false
    state.zoomState = ZoomState.In
    viewMatrix.isRunning = true
    viewMatrix.speed = ZOOM_SPEED_SLOW
    applyBoxMatrix(intentMatrix, box)
  })

  const zoomFull = $.fn(function zoomFull() {
    isWheelHoriz = false
    state.zoomState = ZoomState.Out
    viewMatrix.isRunning = true
    viewMatrix.speed = ZOOM_SPEED_SLOW
    const m = getInitialMatrixValues()
    intentMatrix.a = m.a
    intentMatrix.d = m.d
    intentMatrix.e = m.e
    intentMatrix.f = m.f
  })

  const zoomFar = $.fn(function zoomFar() {
    if (!info.draggingNote) {
      info.hoveringNote = null
      info.focusedBox = null
    }
    viewMatrix.speed = ZOOM_SPEED_NORMAL
    state.zoomState = ZoomState.Out
  })

  keyboard.targets.add(ev => {
    if (ev.type === 'keydown') {
      log(ev.key)
      if (ev.key === 'Escape') {
        if (info.focusedBox) {
          info.hoveringNote = null
          info.focusedBox = null
        }
        else {
          zoomFull()
        }
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
    clicks = 0
  })

  mouse.targets.add(ev => {
    if (screen.info.overlay) return

    isZooming = false
    if (ev.type === 'mouseout' || ev.type === 'mouseleave') {
      unhoverBox()
      if (brush) {
        brush.rect.x = OFFSCREEN_X
        brush = null
      }
      return
    }
    else if (ev.type === 'mouseup') {
      if (info.resizingBox) {
        info.resizingBox = null
        return
      }
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
        }
        else {
          ++clicks
          if (info.hoveringBox?.dimmed) {
            info.hoveringBox.trackBox.track.addBox(
              info.hoveringBox.trackBox.info.source,
              $({
                ...info.hoveringBox.trackBox.data,
                time: info.hoveringBox.rect.x
              }),
            )
            clicks = 0
            $.flush()
          }
          else if (clicks >= 2) {
            info.focusedBox = info.hoveringBox
            zoomBox(info.hoveringBox)
            return
          }
          else if (info.focusedBox === info.hoveringBox && info.hoveringNote) {
            info.draggingNote = info.hoveringNote
            dom.on(window, 'mouseup', $.fn((e: MouseEvent): void => {
              info.hoveringNoteN = -1
              info.hoveringNote = null
              info.draggingNote = null
              requestAnimationFrame(() => {
                updateMousePos()
                handleHoveringNote()
              })
            }), { once: true })
            return
          }
          else if (clicks === 1) {
            if (info.hoverBoxMode === 'resize') {
              info.focusedBox =
                info.resizingBox = info.hoveringBox
              return
            }
            else {
              info.focusedBox = info.hoveringBox
            }
          }
        }
      }
      else {
        ++clicks
        if (clicks >= 2) {
          zoomFull()
        }
        else if (clicks === 1) {
          info.focusedBox = null
        }
      }
    }
    else if (ev.type === 'mousemove' || ev.type === 'mouseenter') {
      mouse.matrix = viewMatrix
      updateMousePos()
      if (info.draggingNote) {
        handleDraggingNoteMove()
        return
      }
      else if (info.resizingBox) {
        const x = Math.round(mouse.screenPos.x)
        const w = Math.max(1, x - info.resizingBox.rect.x)
        info.resizingBox.info.trackBox.data.length = w
        return
      }
    }
    else if (ev.type === 'wheel') {
      const e = ev as WheelEvent

      mouse.matrix = viewMatrix

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
        if (e.shiftKey) {
          const df = -(e.deltaX - (e.altKey ? e.deltaY : 0)) * 2.5 * 0.08 * (intentMatrix.d ** 0.18)
          snap.y = false
          intentMatrix.f -= df
        }
        else {
          const de = (e.deltaX - (e.altKey ? e.deltaY : 0)) * 2.5 * 0.08 * (intentMatrix.a ** 0.18)
          snap.x = false
          intentMatrix.e -= de
        }
      }
      else {
        if (e.ctrlKey) {
          snap.x = false
          intentMatrix.set(viewMatrix.dest)
          updateMousePos()
          handleWheelScaleX(e)
        }
        if (e.shiftKey) {
          snap.y = false
          intentMatrix.set(viewMatrix.dest)
          updateMousePos()
          handleWheelScaleY(e)
        }
        if (!e.ctrlKey && !e.shiftKey) {
          snap.x = snap.y = true
          isZooming = true
          if (e.deltaY > 0) {
            intentMatrix.set(viewMatrix.dest)
          }
          handleZoom(e)
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
      const { track, info: { isFocused, isHovering } } = trackBox
      const color = isFocused || isHovering
        ? track.info.colors.colorBright
        : track.info.colors.color
      $()
      box.view.color = color
      redraw(boxes)
    })

    $.fx(() => {
      $()
      const notes = info.notes = Notes(trackBox, dimmed)
      sketch.scene.add(notes.shapes)
      redraw(notes.shapes)

      waveform = waveformShapes.Wave($({
        get x() { return rect.x },
        get y() { return rect.y + rect.h * NOTES_HEIGHT_NORMAL + rect.h * WAVES_MARGIN_NORMAL * 0.5 },
        get w() { return rect.w },
        get h() { return rect.h * WAVES_HEIGHT_NORMAL - rect.h * WAVES_MARGIN_NORMAL },
      }))
      waveform.view.alpha = alpha

      const off = $.fx(() => {
        const { isFocused } = trackBox.info
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
        const { track } = trackBox
        const { floats } = $.of(track.info)
        const { clock } = $.of(services.audio.dsp.info)
        $()

        waveform.view.color = 0x0
        waveform.view.floats$ = floats.ptr
        waveform.view.len = floats.len
        waveform.view.coeff = clock.coeff

        redraw(waveformShapes)
      })]

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
          // const { length, time } = box.data
          let gridBox = gridBoxMap.get(box)
          if (!gridBox) gridBoxMap.set(
            box,
            gridBox = GridBox(shapes, waveformShapes, box)
          )
          currTrackBoxes.add(box)
          gridBoxes.push(gridBox)
        }

        if (!brushes.get(track)) $.untrack(() => {
          const templateBox = track.info.boxes[0]
          const brushBox = TrackBox(
            track,
            templateBox.info.source,
            templateBox.data,
            $(new Rect, {
              x: OFFSCREEN_X,
              y: track.info.$.y,
              w: templateBox.rect.$.w,
              h: 1
            })
          )
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
      // $()
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

    const info = $({
      trackBox,
      scale: null as null | ReturnType<typeof getNotesScale>
    })

    $.fx(() => {
      const { draggingNote } = gridInfo
      if (draggingNote) return
      info.scale = getNotesScale(info.trackBox.track.info.notesJson)
    })

    const pianoroll = Shapes(view, viewMatrix)

    const cols = pianoroll.Box($({
      get x() { return info.trackBox.rect.x },
      get y() { return info.trackBox.rect.y },
      get w() { return info.trackBox.rect.w },
      get h() { return info.trackBox.rect.h },
    }))
    cols.view.opts |= ShapeOpts.Cols
    cols.view.alpha = 0.3

    function show() {
      sketch.scene.add(pianoroll)
    }

    function hide() {
      sketch.scene.delete(pianoroll)
    }

    return { info, show, hide }
  }

  function Notes(trackBox: TrackBox, dimmed: boolean = false) {
    using $ = Signal()

    const shapes = Shapes(view, viewMatrix)

    const info = $({
      update: 0,
      trackBox,
      scale: null as null | ReturnType<typeof getNotesScale>
    })

    $.fx(() => {
      const { draggingNote } = gridInfo
      if (draggingNote) return
      info.scale = getNotesScale(trackBox.track.info.notesJson)
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
      const { track, info: { isFocused } } = trackBox
      const { colors } = track.info
      const { primaryColorInt } = screen.info
      $()
      notesShape.view.color = 0x0 //isFocused && !dimmed ? colors.colorBright : colors.fg
      notesShape.view.hoverColor = primaryColorInt
    })

    $.fx(() => {
      const { scale } = $.of(info)
      const { notesData } = trackBox.track.info
      $()
      notesShape.view.notes$ = notesData.ptr
      notesShape.view.min = scale.min
      notesShape.view.max = scale.max
      redraw(shapes)
    })

    $.fx(() => {
      const { isFocused } = trackBox.info
      $()
      notesShape.view.isFocused = Number(Boolean(isFocused))
      if (isFocused) {
        return $.fx(() => {
          const { hoveringNote } = gridInfo
          $()
          notesShape.view.hoveringNote$ = hoveringNote?.data.ptr ?? 0
          return () => {
            notesShape.view.hoveringNote$ = 0
          }
        })
      }
    })

    return { info, shapes }
  }

  const overlayMatrix = $(new Matrix, { d: intentMatrix.$.d })
  const overlay = Shapes(view, overlayMatrix)

  const rulerNow = overlay.Line(
    $({ x: 0, y: 0 }),
    $({ x: 0, get y() { return lib.project?.info.tracks.length ?? 0 } })
  )
  rulerNow.view.opts |= ShapeOpts.InfY
  $.fx(() => {
    rulerNow.view.color = screen.info.primaryColorInt
  })
  sketch.scene.add(overlay)
  // overlay.update()

  $.fx(() => {
    const { timeNow } = services.audio.info
    $()
    redraw(overlay)
  })

  $.fx(() => {
    const { boxes } = $.of(info)
    const {
      info: { timeNow: x },
      player: { info: { isPlaying } }
    } = services.audio
    $()
    const m = intentMatrix
    const HALF = view.w / 2 - HEADS_WIDTH / 2
    intentMatrix.e = -boxes.info.left * m.a + HALF
  })
  $.fx(() => {
    const { boxes } = $.of(info)
    const {
      info: { timeNow: x },
      player: { info: { isPlaying } }
    } = services.audio
    // const { x } = rulerNow.p0
    const m = isPlaying ? intentMatrix : viewMatrix
    if (isPlaying) {
      const { a } = m
    }
    else {
      const { a, e } = m
    }
    $()
    if (isPlaying) {
      overlayMatrix.a = 1
      overlayMatrix.e = 0
      const HALF = view.w / 2 - HEADS_WIDTH / 2
      rulerNow.p0.x =
        rulerNow.p1.x = HALF
      intentMatrix.e = -x * m.a + HALF
      snap.x = false
    }
    else {
      const HALF = view.w / 2 - HEADS_WIDTH / 2
      rulerNow.p0.x =
        rulerNow.p1.x = boxes.info.left
      overlayMatrix.a = m.a
      overlayMatrix.e = m.e + 1
    }
  })

  $.fx(() => {
    const { isPlaying } = services.audio.player.info
    $()
    surface?.anim.ticks.add(services.audio.tick)
    services.audio.tick()
    info.redraw++
  })

  function redraw(shapes?: Shapes) {
    shapes?.update()
    info.redraw++
  }

  $.fx(function clear_clicks_when_hovering_other() {
    const { hoveringBox } = info
    clicks = 0
  })

  $.fx(function update_hovering_box_color() {
    const { hoveringBox } = $.of(info)
    $()
    applyBoxMatrix(targetMatrix, hoveringBox)
    hoveringBox.box.view.color = hoveringBox.trackBox.track.info.colors.colorBright
    return () => {
      hoveringBox.box.view.color = hoveringBox.trackBox.track.info.colors.color
    }
  })

  $.fx(function update_box_isFocused() {
    const { project } = $.of(lib)
    const { focusedBox } = info
    if (!focusedBox) {
      $()
      pianoroll?.hide()
      redraw()
      return
    }
    const { trackBox } = focusedBox
    $()
    trackBox.info.isFocused = true
    project.info.activeTrack = trackBox.track
    project.info.activeTrackBox = trackBox
    return () => {
      trackBox.info.isFocused = false
    }
  })

  $.fx(function update_box_isHovering() {
    const { hoveringBox } = $.of(info)
    const { trackBox } = hoveringBox
    $()
    trackBox.info.isHovering = true
    return () => {
      trackBox.info.isHovering = false
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
    handleZoom,
    handleWheelScaleX,
    updateHoveringBox,
  }

  return grid
}
