import { $, Signal } from 'signal-jsx'
import { ShapeKind } from '../../as/assembly/sketch-shared.ts'
import { ShapeData } from '../gl/sketch.ts'
import { Surface } from '../surface.ts'
import { Floats } from '../util/floats.ts'
import { PointLike, clamp } from 'utils'
import { Matrix, RectLike } from 'std'

const DEBUG = false

export type Grid = ReturnType<typeof Grid>

export function Grid(surface: Surface) {
  using $ = Signal()

  const { anim, mouse, view, matrix, wasmMatrix, sketch } = surface

  // create Box data
  const ROWS = 4
  const COLS = 12
  const SCALE_X = 16

  let boxes = Boxes(ROWS, COLS, SCALE_X)
  let waves = Waves(boxes)
  let notes = Notes(boxes)

  $.untrack(function initial_scale() {
    if (matrix.a === 1) {
      matrix.m.a = view.w / (COLS * SCALE_X)
      matrix.m.d = view.h / ROWS
      matrix.sync()
    }
  })

  $.fx(function scale_rows_to_fit_height() {
    const { h } = view
    $()
    matrix.m.d = h / ROWS
    matrix.sync()
  })

  function write() {
    sketch.shapes.count = 0
    sketch.write(boxes.data)
    sketch.write(waves.data)
    sketch.write(notes.data)
    anim.info.epoch++
  }

  // interaction

  const p = { x: 0, y: 0 }
  const s = { x: 0, y: 0 }
  const r = { x: 0, y: 0, w: 0, h: 0 }
  let mousePos = { x: 0, y: 0 }
  let hoveringBox: RectLike | null

  let lockedZoom: boolean
  $.fx(function apply_wasm_matrix() {
    const { a, b, c, d, e, f } = matrix
    $()
    lockedZoom = false
    const m = wasmMatrix.dest
    m.set(matrix)

    if (hoveringBox) {
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
          lockedZoom = true
        }
      }
    }
  })

  function transformMatrixPoint(m: Matrix, p: PointLike, t: PointLike) {
    const { a, b, c, d, e, f } = m
    const { x, y } = p
    t.x = a * x + c * y + e
    t.y = b * x + d * y + f
    return t
  }

  function transformMatrixRect(m: Matrix, p: RectLike, t: RectLike) {
    const { a, b, c, d, e, f } = m
    const { x, y, w, h } = p
    t.x = a * x + c * y + e
    t.y = b * x + d * y + f
    t.w = a * w + c * h
    t.h = b * w + d * h
    return t
  }

  function handleWheelScaleY(e: WheelEvent) {
    const { x, y } = mousePos

    const m = matrix.m
    const d = m.d
    const delta = -e.deltaY * 0.0035
    const delta_d = (d + (delta * d ** 0.9)) / d

    DEBUG && console.log('[grid] wheelDelta d:', d, delta, delta_d)

    m.translateSelf(x, y).scaleSelf(1, delta_d)
    m.d = clamp(0.01, 2000, m.d)
    m.translateSelf(-x, -y)
    matrix.sync()
  }

  function handleWheelScaleX(e: WheelEvent) {
    const { x, y } = mousePos

    const m = matrix.m
    const a = m.a
    const delta = -e.deltaY * 0.0035
    if (lockedZoom && delta > 0) return
    const delta_a = (a + (delta * a ** 0.9)) / a

    DEBUG && console.log('[grid] wheelDelta a:', a, delta, delta_a)

    m.translateSelf(x, y).scaleSelf(delta_a, 1)
    m.a = clamp(0.01, 2000, matrix.m.a)
    m.translateSelf(-x, -y)
    matrix.sync()

    DEBUG && console.log('[grid] matrix.a:', m.a)
  }

  function updateMousePos() {
    const { x, y } = mouse.screenPos
    mousePos.x = x
    mousePos.y = y
  }

  mouse.targets.add(ev => {
    let { x, y } = mouse.screenPos

    // mousePos only register intentional move
    if (ev.type === 'mousemove') {
      updateMousePos()
      matrix.set(wasmMatrix)
    }

    // handle hovering box

    x = Math.floor(x)
    y = Math.floor(y)

    const box = boxesHitmap.get(`${x}:${y}`)

    if (box) {
      if (!hoveringBox || hoveringBox.x !== box.x || hoveringBox.y !== box.y) {
        hoveringBox = box
        boxes = Boxes(ROWS, COLS, SCALE_X, box)
        write()
      }
    }
    else {
      if (hoveringBox) {
        hoveringBox = null
        boxes = Boxes(ROWS, COLS, SCALE_X)
        write()
      }
    }

    // handle wheel
    if (ev.type === 'wheel') {
      const e = ev as WheelEvent
      if (e.shiftKey) {
        updateMousePos()
        matrix.m.e += e.deltaY * 0.04 * (matrix.m.a ** 0.65)
        matrix.sync()
      }
      else if (e.ctrlKey) {
        handleWheelScaleY(e)
      }
      else {
        handleWheelScaleX(e)
      }
    }
  })

  return { write }
}

const boxesHitmap = new Map()

function Boxes(rowsLength: number, cols: number, scaleX: number, hover: RectLike = { x: -1, y: -1, w: 0, h: 0 }) {
  boxesHitmap.clear()

  const rows = Array.from({ length: rowsLength }, (_, ry) => {
    const mul = (ry % 2 === 1 ? 4 : 1)
    return Array.from({ length: cols * mul }, (_, rx) => {
      const x = rx * (scaleX / mul) //scaleX + Math.round(Math.random() * 4),
      const y = ry
      const w = scaleX / mul //1 + Math.round(Math.random() * 12), // w
      const h = 1 // h

      for (let i = x; i < x + w; i++) {
        boxesHitmap.set(`${i}:${y}`, { x, y, w, h })
      }

      return [
        ShapeKind.Box,
        x, y, w, h,
        1, 1, 0, // lw, ptr, len
        hover.x === x && hover.y === y
          ? 0xaaaaaa
          : 0x770000 + 0x111111 * (Math.sin(ry * 100) * 0.5 + 0.5), // color
        1.0 // alpha
      ] as ShapeData.Box
    })
  })

  const data = new Float32Array(rows.flat(Infinity) as number[])

  return { rows, data }
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
    .filter((_, y) => y % 2 === 0)
    .map(cols =>
      cols.map(([, x, y, w, h]) =>
        notes.map(({ n, time, length, vel }) => {
          const nx = time * scaleX // x
          if (nx > w) return

          const nh = h / scale.N
          const ny = h - nh * (n - scale.min) // y

          let nw = length * scaleX // w
          if (nx + nw > w) {
            nw = w - nx
          }

          return [
            ShapeKind.Box,
            x + nx,
            y + ny,
            nw,
            nh,
            1, // lw
            1, // ptr
            0, // len
            0x0,
            .2 + (.8 * vel) // alpha
          ] as ShapeData.Box
        }).filter(Boolean).flat()
      ).flat()
    ).flat())

  return { data }
}
