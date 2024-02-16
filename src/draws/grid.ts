import { $, Signal } from 'signal-jsx'
import { Matrix, Point, RectLike } from 'std'
import { clamp, debounce } from 'utils'
import { ShapeKind } from '../../as/assembly/sketch-shared.ts'
import { ShapeData } from '../gl/sketch.ts'
import { Surface } from '../surface.ts'
import { Floats } from '../util/floats.ts'
import { lerpMatrix, transformMatrixRect } from '../util/geometry.ts'
import { log, state } from '../state.ts'

const DEBUG = true

export type Grid = ReturnType<typeof Grid>

export function Grid(surface: Surface) {
  using $ = Signal()

  const { anim, mouse, keyboard, view, intentMatrix, viewMatrix, sketch } = surface
  const { lastFarMatrix, targetMatrix } = state

  // create Box data
  const ROWS = 10
  const COLS = 120
  const SCALE_X = 16

  const boxes = Boxes(ROWS, COLS, SCALE_X)
  const waves = Waves(boxes)
  const notes = Notes(boxes)
  let pianorollData: Float32Array | null

  const info = $({
    boxes,
    waves,
    notes,
    focusedBox: null as null | BoxData
  })

  $.untrack(function initial_scale() {
    if (intentMatrix.a === 1) {
      viewMatrix.a = intentMatrix.a = Math.max(12, view.w / (COLS * SCALE_X))
      viewMatrix.d = intentMatrix.d = view.h / ROWS
      lastFarMatrix.set(viewMatrix)
      $.fx(function scale_rows_to_fit_height() {
        const { h } = view
        $()
        intentMatrix.d = h / ROWS
      })
    }
  })

  function write() {
    sketch.shapes.count = 0
    sketch.write(info.boxes.data)
    sketch.write(info.waves.data)
    sketch.write(info.notes.data)
    if (pianorollData) sketch.write(pianorollData)
    anim.info.epoch++
  }

  // interaction

  const p = { x: 0, y: 0 }
  const s = { x: 0, y: 0 }
  const r = { x: 0, y: 0, w: 0, h: 0 }
  let mousePos = { x: 0, y: 0 }
  let hoveringBox: BoxData | null

  const snap = { x: false, y: false }
  const lockedZoom = { x: false, y: false }
  $.fx(function apply_wasm_matrix() {
    const { a, b, c, d, e, f } = intentMatrix
    $()
    lockedZoom.x = false
    lockedZoom.y = false

    const m = viewMatrix.dest
    m.set(intentMatrix)
    // log(-info.boxes.right * m.a + view.w / 2, view.w / 2, m.e)
    m.e = clamp(-info.boxes.right * m.a + mouse.pos.x, mouse.pos.x, m.e)
    intentMatrix.a = m.a
    intentMatrix.e = m.e
    // log(m.e)

    if (hoveringBox) {
      if (snap.y && snap.x) {
        transformMatrixRect(m, hoveringBox, r)
        if (r.x < 0) {
          m.e -= r.x
        }
        transformMatrixRect(m, hoveringBox, r)
        if (r.x + r.w > view.w) {
          m.e -= r.x + r.w - view.w
          transformMatrixRect(m, hoveringBox, r)
          if (r.x < 0) {
            m.a = (view.w / hoveringBox.w)
            m.e = -hoveringBox.x * m.a
            lockedZoom.x = true
          }
        }
      }

      if (snap.y) {
        transformMatrixRect(m, hoveringBox, r)
        if (r.y < 0) {
          m.f -= r.y
        }
        transformMatrixRect(m, hoveringBox, r)
        if (r.y + r.h > view.h) {
          m.f -= r.y + r.h - view.h
          transformMatrixRect(m, hoveringBox, r)
          if (r.y < 0) {
            m.d = (view.h / hoveringBox.h)
            m.f = -hoveringBox.y * m.d
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

  const point = $(new Point)

  function handleWheelScaleX(e: WheelEvent) {
    const { x, y } = mousePos

    const m = intentMatrix
    const a = m.a
    const delta = -e.deltaY * 0.0035
    if (lockedZoom.x && delta > 0) return
    const delta_a = (a + (delta * a ** 0.9)) / a
    const minZoomX = view.w / 2 / info.boxes.right
    m.translate(x, y)
    m.scale(delta_a, 1)
    m.a = clamp(minZoomX, 2000, intentMatrix.a)
    m.translate(-x, -y)

    if (state.zoomState === 'zooming') {
      const lm = lastFarMatrix
      point
        .setParameters(mouse.pos.x, mouse.pos.y)
        .transformMatrixInverse(lm)
      const { x, y } = point
      lm.translate(x, y)
      lm.scale(m.a / a, 1)
      lm.translate(-x, -y)
    }
  }

  function unhoverBox() {
    if (hoveringBox) {
      hoveringBox.setColor(hoveringBox.color)
      hoveringBox = null
      write()
    }
  }

  function handleHoveringBox() {
    let { x, y } = mouse.screenPos
    x = Math.floor(x)
    y = Math.floor(y)

    if (!isZooming) {
      const box = boxesHitmap.get(`${x}:${y}`)

      if (box) {
        if (!hoveringBox || hoveringBox.x !== box.x || hoveringBox.y !== box.y) {
          applyBoxMatrix(targetMatrix, box)
          if (hoveringBox) {
            hoveringBox.setColor(hoveringBox.color)
          }
          hoveringBox = box
          box.setColor(BOX_HOVER_COLOR)
          write()
        }
      }
      else {
        unhoverBox()
      }
    }
  }

  function updateMousePos() {
    const { x, y } = mouse.screenPos
    mousePos.x = x
    mousePos.y = y
  }

  let isWheelHoriz = false
  let isZooming = false

  DEBUG && $.fx(() => {
    const { zoomState } = state
    $()
    log('zoomState', zoomState)
  })

  DEBUG && $.fx(() => {
    const { a } = viewMatrix
    $()
    // log('m.a', a)
  })

  const zoomFar = $.fn(function zoomFar() {
    info.focusedBox = null
    viewMatrix.speed = ZOOM_SPEED_NORMAL
    state.zoomState = 'far'
    intentMatrix.set(lastFarMatrix)
  })

  const ZOOM_SPEED_SLOW = 0.2
  const ZOOM_SPEED_NORMAL = 0.3
  $.fx(() => {
    const { isRunning } = viewMatrix
    $()
    if (!isRunning) {
      if (viewMatrix.speed === ZOOM_SPEED_SLOW) {
        viewMatrix.speed = ZOOM_SPEED_NORMAL
      }
    }
  })

  function applyBoxMatrix(m: Matrix, box: RectLike & { notes?: Note[] }) {
    const w = box?.notes ? box.w + 1 : box.w
    const ox = box?.notes ? 1 : 0
    Matrix.viewBox(m, view, {
      x: box.x - w / 20 - ox,
      y: box.y - .1,
      w: w + w / 10,
      h: box.h + .2,
    })
  }

  const zoomBox = $.fn(function zoomBox(box: RectLike & { notes?: Note[] }) {
    isWheelHoriz = false
    state.zoomState = 'zooming'
    viewMatrix.isRunning = true
    viewMatrix.speed = ZOOM_SPEED_SLOW
    applyBoxMatrix(intentMatrix, box)
  })

  keyboard.targets.add(ev => {
    if (ev.type === 'keydown') {
      log(ev.key)
      if (ev.key === 'Escape') {
        zoomFar()
      }
    }
  })

  let orientChangeScore = 0
  let clicks = 0
  const debounceClearClicks = debounce(300, () => {
    clicks = 0
  })
  mouse.targets.add(ev => {
    isZooming = false
    if (ev.type === 'mouseout' || ev.type === 'mouseleave') {
      unhoverBox()
      return
    }
    else if (ev.type === 'mousedown') {
      updateMousePos()
      if (hoveringBox) {
        debounceClearClicks()
        if (++clicks === 2) {
          if (state.zoomState === 'far') {
            lastFarMatrix.set(intentMatrix)
          }
          info.focusedBox = hoveringBox
          zoomBox(hoveringBox)
        }
      }
    }
    else if (ev.type === 'mousemove') {
      updateMousePos()
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
        lastFarMatrix.e -= (de / intentMatrix.a) * lastFarMatrix.a
      }
      else {
        if (e.ctrlKey) {
          updateMousePos()
          handleWheelScaleX(e)
        }
        else {
          isZooming = true
          if (e.deltaY > 0) {
            if (state.zoomState === 'zooming') {
              viewMatrix.speed = ZOOM_SPEED_NORMAL
              log(intentMatrix.d)
              if (intentMatrix.d < 100) {
                info.focusedBox = null
              }
              const amt = Math.min(.5, Math.abs(e.deltaY / ((viewMatrix.a * 0.08) ** 1.12) * ((targetMatrix.a * 0.1) ** 1.15) * .85) * .004)
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
              if (intentMatrix.d > 150) {
                info.focusedBox = hoveringBox
              }
              const amt = Math.min(.5, Math.abs(e.deltaY * ((viewMatrix.a * 0.08) ** 0.92) / ((targetMatrix.a * 0.1) ** 0.5) * .85) * .0014)
              lerpMatrix(intentMatrix, targetMatrix, amt)
            }
          }
        }
      }
    }

    handleHoveringBox()
  })

  $.fx(() => {
    const { a, b, c, d, e, f } = viewMatrix
    $()
    handleHoveringBox()
  })

  const BLACK_KEYS = new Set([1, 3, 6, 8, 10])
  const KEY_NAMES = [
    'c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'
  ]
  $.fx(() => {
    const { focusedBox } = $.of(info)
    $()
    if (focusedBox.notes) {
      log('yeah')
      const { notes } = focusedBox
      const scale = getNotesScale(notes)
      const scaleX = 1

      const { x: cx, y: cy, w: cw, h: ch } = focusedBox

      const SNAPS = 16
      pianorollData = Float32Array.from([
        [
          ShapeKind.Box,
          cx,
          cy,
          cw,
          ch,
          1, // lw
          1, // ptr
          0, // len
          0x0,
          .92 // alpha
        ] as ShapeData.Box,
        Array.from({ length: scale.N }, (_, ny) => {
          const h = ch / scale.N
          const y = cy + h * ny
          const n = scale.N - ny + scale.min
          const n_key = n % 12
          const isBlack = BLACK_KEYS.has(n_key)
          const row = [
            ShapeKind.Box,
            cx,
            y,
            cw,
            h,
            1, // lw
            1, // ptr
            0, // len
            focusedBox.color,
            .25 + (isBlack ? 0 : .10) // alpha
          ] as ShapeData.Box
          const key = [
            ShapeKind.Box,
            cx - 1,
            y,
            1,
            h,
            1, // lw
            1, // ptr
            0, // len
            isBlack ? 0x0 : 0xffffff,
            1.0 // alpha
          ] as ShapeData.Box
          return [row, key]
        }).flat(),
        Array.from({ length: (cw * SNAPS) - 1 }, (_, col) => {
          const x = (1 + col) / SNAPS + cx
          return [
            ShapeKind.Line,
            x,
            cy,
            x,
            cy + ch,
            col % 16 === 15 ? 1.5 : col % 4 === 3 ? 1 : .5, // lw
            1, // ptr
            0, // len
            0x0,
            1 // alpha
          ] as ShapeData.Line
        }),
        notes.map(({ n, time, length, vel }) => {
          const x = time * scaleX // x
          if (x > cw) return

          const h = ch / scale.N
          const y = ch - h * (n - scale.min) // y

          let w = length * scaleX // w
          if (x + w > cw) {
            w = cw - x
          }

          return [
            ShapeKind.Box,
            cx + x,
            cy + y,
            w,
            h,
            1, // lw
            1, // ptr
            0, // len
            focusedBox.color,
            .45 + (.55 * vel) // alpha
          ] as ShapeData.Box
        }).filter(Boolean).flat()
      ].flat().flat())

      write()
    }
    return () => {
      log('nop')
      pianorollData = null
      write()
    }
  })

  // DEV KEEP: (un)comment when working with notes
  info.focusedBox = boxes.rows[0][1].data
  zoomBox(info.focusedBox)

  return { info, write, view, mouse, mousePos, intentMatrix, lastFarMatrix, handleWheelScaleX }
}

type BoxData = RectLike & {
  ptr: number
  color: number
  setColor: (color: number) => void
  notes?: Note[]
}

const boxesHitmap = new Map<string, BoxData>()

const BOX_HOVER_COLOR = 0x777777

function Boxes(rowsLength: number, cols: number, scaleX: number) {
  boxesHitmap.clear()

  let right = 0
  let ptr = 0
  const rows = Array.from({ length: rowsLength }, (_, ry) => {
    const mul = (ry % 2 === 1 ? 4 : 1)
    return Array.from({ length: cols * mul }, (_, rx) => {
      const x = (rx + Math.round(Math.random() * 0)) * (scaleX / mul)
      const y = ry
      const w = scaleX / mul // w
      const h = 1 // h
      const color = Math.floor((0xaa0000 + 0xfff * (Math.sin(ry * 10) * 0.5 + 0.5)) % 0xffffff)

      const boxData: BoxData = {
        x, y, w, h, ptr, color, setColor(color: number) {
          setColor(this.ptr, color)
        }
      }

      for (let i = x; i < x + w; i++) {
        boxesHitmap.set(`${i}:${y}`, boxData)
      }

      right = Math.max(right, x + w)

      const shape = Object.assign([
        ShapeKind.Box,
        x, y, w, h,
        1, 1, 0, // lw, ptr, len
        color, // color
        1.0 // alpha
      ] as ShapeData.Box, { ptr, data: boxData })

      ptr += shape.length

      return shape
    })
  })

  const data = new Float32Array(rows.flat(Infinity) as number[])

  function setColor(ptr: number, color: number) {
    // TODO: sketch.shape.box.color
    data[ptr + 8] = color
  }

  return { rows, right, data, setColor }
}

const waveformLength = 2048
const waveform = Float32Array.from({ length: waveformLength }, (_, i) =>
  Math.sin((i * 100) / waveformLength * Math.PI * 2) // sine wave
  * (1 - (((i * 4) / waveformLength) % 1) ** .2) // envelope
)

let floats: Floats

function Waves(boxes: ReturnType<typeof Boxes>) {
  if (!floats) {
    floats = Floats(waveform)
  }

  const data = new Float32Array(boxes.rows
    .filter((_, y) => y % 2 === 1)
    .map(cols =>
      cols.map(([, x, y, w, h]) =>
        [
          ShapeKind.Wave,
          x, y, w, h, // same dims as the box
          1, // lw
          floats.ptr, // ptr
          waveformLength, // len
          0x0, //0ffff, // color
          1.0, // alpha
        ] as ShapeData.Wave
      ).flat()
    ).flat())

  return { data }
}

interface Note {
  n: number
  time: number
  length: number
  vel: number
}

function createDemoNotes(
  base = 60, // middle C
  count = 3,
  step = 1,
  // length = 1,
) {
  return Array.from({ length: 16 }, (_, i) => {
    const time = i * step //* 4
    const length = Math.round(Math.random() * 4)
    // const count = 1 //+ Math.round(Math.random() * 2)
    // const base = 12 //+ Math.floor(Math.random() * 12)
    const notes: Note[] = []
    const y = base + Math.round(Math.random() * 8)

    for (let n = 0; n < count; n++) {
      const note = {
        n: y + n * (2 + Math.round(Math.random() * 2)), ///* i === 0 ? 127 - n * 3 :  */base + i + n * 3,
        time,
        length,
        vel: Math.random()
      }
      notes.push($(note))
    }
    return notes
  }).flat()
}

function getNotesScale(notes: Note[]) {
  let max = -Infinity
  let min = Infinity
  for (const note of notes) {
    if (note.n > max) max = note.n
    if (note.n < min) min = note.n
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0
    max = 12
  }
  min = Math.max(0, min - 6)
  max = Math.min(127, max + 6)
  const N = max - min
  return { min, max, N }
}

function Notes(boxes: ReturnType<typeof Boxes>) {
  const notes = createDemoNotes()
  const scale = getNotesScale(notes)
  const scaleX = 1

  const data = new Float32Array(boxes.rows
    .filter((_, ry) => ry % 2 === 0)
    .map(cols =>
      cols.map(box => {
        const [, cx, cy, cw, ch] = box

        box.data.notes = [...notes]

        const boxNotes = notes.map(({ n, time, length, vel }) => {
          const x = time * scaleX // x
          if (x > cw) return

          const h = ch / scale.N
          const y = ch - h * (n - scale.min) // y

          let w = length * scaleX // w
          if (x + w > cw) {
            w = cw - x
          }

          return [
            ShapeKind.Box,
            cx + x,
            cy + y,
            w,
            h,
            1, // lw
            1, // ptr
            0, // len
            0x0,
            .2 + (.8 * vel) // alpha
          ] as ShapeData.Box
        })

        return boxNotes.filter(Boolean).flat()
      }).flat()
    ).flat())

  return { data }
}
