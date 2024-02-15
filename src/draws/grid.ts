import { $, Signal } from 'signal-jsx'
import { Matrix, RectLike } from 'std'
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
  const ROWS = 8
  const COLS = 120
  const SCALE_X = 16

  const boxes = Boxes(ROWS, COLS, SCALE_X)
  const waves = Waves(boxes)
  const notes = Notes(boxes)

  const info = $({
    boxes,
    waves,
    notes,
  })

  $.untrack(function initial_scale() {
    Matrix.viewBox(lastFarMatrix, view, {
      x: 0,
      y: 0,
      w: info.boxes.right,
      h: info.boxes.rows.length
    })
    if (intentMatrix.a === 1) {
      viewMatrix.a = intentMatrix.a = view.w / (COLS * SCALE_X)
      viewMatrix.d = intentMatrix.d = view.h / ROWS
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
    anim.info.epoch++
  }

  // interaction

  const p = { x: 0, y: 0 }
  const s = { x: 0, y: 0 }
  const r = { x: 0, y: 0, w: 0, h: 0 }
  let mousePos = { x: 0, y: 0 }
  let hoveringBox: RectLike | null

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
    m.e = clamp(-info.boxes.right * m.a + mouse.pos.x + 2, mouse.pos.x - 2, m.e)
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
  }

  function setTargetMatrix(box: RectLike) {
    Matrix.viewBox(targetMatrix, view, box)
  }

  function handleHoveringBox() {
    let { x, y } = mouse.screenPos
    x = Math.floor(x)
    y = Math.floor(y)

    if (!isZooming) {
      const box = boxesHitmap.get(`${x}:${y}`)

      if (box) {
        if (!hoveringBox || hoveringBox.x !== box.x || hoveringBox.y !== box.y) {
          setTargetMatrix(box)
          hoveringBox = box
          info.boxes = Boxes(ROWS, COLS, SCALE_X, box)
          write()
        }
      }
      else {
        if (hoveringBox) {
          hoveringBox = null
          info.boxes = Boxes(ROWS, COLS, SCALE_X)
          write()
        }
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

  function zoomFar() {
    state.zoomState = 'far'
    intentMatrix.set(lastFarMatrix)
  }

  keyboard.targets.add(ev => {
    if (ev.type === 'keydown') {
      log(ev.key)
      if (ev.key === 'Escape') {
        zoomFar()
      }
    }
  })

  mouse.targets.add(ev => {
    isZooming = false
    if (ev.type === 'mousedown') {
      updateMousePos()
      if (hoveringBox) {
        if (state.zoomState === 'far') {
          lastFarMatrix.set(intentMatrix)
        }
        state.zoomState = 'zooming'
        Matrix.viewBox(intentMatrix, view, hoveringBox)
      }
    }
    else if (ev.type === 'wheel') {
      const e = ev as WheelEvent

      mouse.matrix = intentMatrix

      const isHoriz =
        Math.abs(e.deltaX) * (isWheelHoriz ? 4 : 3) >
        Math.abs(e.deltaY) * (isWheelHoriz ? .5 : 1)

      if (isHoriz !== isWheelHoriz) {
        updateMousePos()
        isWheelHoriz = isHoriz
      }

      if (isHoriz) {
        mouse.matrix = viewMatrix
        const de = e.deltaX * 1.5 * 0.04 * (intentMatrix.a ** 0.65)
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
              const amt = Math.min(1, Math.abs(e.deltaY) / 400)
              lerpMatrix(intentMatrix, lastFarMatrix, amt)
              if (Matrix.compare(intentMatrix, lastFarMatrix, 20.0)) {
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
              const amt = Math.min(1, Math.abs(e.deltaY) / 800)
              lerpMatrix(intentMatrix, targetMatrix, amt)
            }
          }
        }
      }
    }

    // // handle wheel
    // if (ev.type === 'wheel') {
    //   snap.x = true
    //   snap.y = true
    //   mouse.matrix = intentMatrix

    //   const e = ev as WheelEvent

    //   const isHoriz = Math.abs(e.deltaX) * (isWheelHoriz ? 4 : 1.5) > Math.abs(e.deltaY) * (isWheelHoriz ? 1 : 2.5)
    //   if (isHoriz !== isWheelHoriz) {
    //     updateMousePos()
    //     isWheelHoriz = isHoriz
    //   }

    //   if ((e.altKey || isWheelHoriz) && !e.shiftKey) {
    //     isZooming = false
    //     updateMousePos()
    //     if (!e.altKey) {
    //       mouse.matrix = viewMatrix
    //       returningToLastScroll = false
    //       lastIntentMatrix.set(viewMatrix)
    //       snap.x = false
    //     }
    //     else if (!e.ctrlKey) {
    //       mouse.matrix = viewMatrix
    //       returningToLastScroll = false
    //       lastIntentMatrix.set(viewMatrix)
    //       snap.y = false
    //     }
    //     if (isWheelHoriz) {
    //       intentMatrix.m.e -= e.deltaX * 1.5 * 0.04 * (intentMatrix.m.a ** 0.65)
    //     }
    //     else {
    //       intentMatrix.m.f -= e.deltaY * 0.01 * (intentMatrix.m.d ** 0.65)

    //     }
    //     intentMatrix.sync()
    //   }
    //   else {
    //     const delta = isHoriz ? e.deltaX : e.deltaY
    //     if (!e.ctrlKey && !e.shiftKey && (returningToLastScroll || lockedZoom.x || lockedZoom.y) && delta > 0) {
    //       returningToLastScroll = true
    //       const amt = Math.min(1, delta / 400)
    //       const lm = lastIntentMatrix
    //       const m = intentMatrix
    //       lerpMatrix(m, lm, amt)
    //     }
    //     else {
    //       if (e.ctrlKey || lockedZoom.x) {
    //         handleWheelScaleY(e)
    //       }
    //       if (!e.ctrlKey || e.shiftKey) {
    //         handleWheelScaleX(e)
    //       }
    //     }
    //   }

    // }

    // // mousePos only register intentional move
    // if (ev.type === 'mousemove') {
    //   isZooming = false
    //   updateMousePos()
    //   returningToLastScroll = false
    //   lastIntentMatrix.set(viewMatrix)
    //   intentMatrix.set(viewMatrix)
    // }

    handleHoveringBox()
  })

  $.fx(() => {
    const { a, b, c, d, e, f } = viewMatrix
    $()
    handleHoveringBox()
  })

  return { write }
}

const boxesHitmap = new Map()

function Boxes(rowsLength: number, cols: number, scaleX: number, hover: RectLike = { x: -1, y: -1, w: 0, h: 0 }) {
  boxesHitmap.clear()

  let right = 0

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

      right = Math.max(right, x + w)

      return [
        ShapeKind.Box,
        x, y, w, h,
        1, 1, 0, // lw, ptr, len
        hover.x === x && hover.y === y
          ? 0x777777
          : 0x770000 + 0x111111 * (Math.sin(ry * 100) * 0.5 + 0.5), // color
        1.0 // alpha
      ] as ShapeData.Box
    })
  })

  const data = new Float32Array(rows.flat(Infinity) as number[])

  return { rows, right, data }
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
