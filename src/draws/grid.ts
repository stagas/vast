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

  const info = $({
    boxes,
    waves,
    notes,
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

  function setTargetMatrix(box: RectLike) {
    Matrix.viewBox(targetMatrix, view, {
      x: box.x - box.w / 20,
      y: box.y - .1,
      w: box.w + box.w / 10,
      h: box.h + .2,
    })
    log(mousePos.x)
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
          setTargetMatrix(box)
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
    log('m.a', a)
  })

  const zoomFar = $.fn(function zoomFar() {
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

  const zoomBox = $.fn(function zoomBox(box: RectLike) {
    isWheelHoriz = false
    state.zoomState = 'zooming'
    viewMatrix.isRunning = true
    viewMatrix.speed = ZOOM_SPEED_SLOW
    Matrix.viewBox(intentMatrix, view, {
      x: box.x - box.w / 20,
      y: box.y - .1,
      w: box.w + box.w / 10,
      h: box.h + .2,
    })
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
  mouse.targets.add(ev => {
    // if (!surface.info.isHovering) return

    isZooming = false
    if (ev.type === 'mouseout' || ev.type === 'mouseleave') {
      unhoverBox()
      return
    }
    else if (ev.type === 'mousedown') {
      updateMousePos()
      if (hoveringBox) {
        if (state.zoomState === 'far') {
          lastFarMatrix.set(intentMatrix)
        }
        zoomBox(hoveringBox)
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

  return { write }
}

type BoxData = RectLike & { ptr: number, color: number, setColor: (color: number) => void }

const boxesHitmap = new Map<string, BoxData>()

const BOX_HOVER_COLOR = 0x777777

function Boxes(rowsLength: number, cols: number, scaleX: number) {
  boxesHitmap.clear()

  let right = 0
  let ptr = 0
  const rows = Array.from({ length: rowsLength }, (_, ry) => {
    const mul = (ry % 2 === 1 ? 4 : 1)
    return Array.from({ length: cols * mul }, (_, rx) => {
      const x = rx * (scaleX / mul) //scaleX + Math.round(Math.random() * 4),
      const y = ry
      const w = scaleX / mul //1 + Math.round(Math.random() * 12), // w
      const h = 1 // h
      const color = 0x770000 + 0x111111 * (Math.sin(ry * 100) * 0.5 + 0.5)

      for (let i = x; i < x + w; i++) {
        boxesHitmap.set(`${i}:${y}`, {
          x, y, w, h, ptr, color, setColor(color: number) {
            setColor(this.ptr, color)
          }
        })
      }

      right = Math.max(right, x + w)

      const shape = Object.assign([
        ShapeKind.Box,
        x, y, w, h,
        1, 1, 0, // lw, ptr, len
        color, // color
        1.0 // alpha
      ] as ShapeData.Box, { ptr })

      ptr += shape.length

      return shape
    })
  })

  const data = new Float32Array(rows.flat(Infinity) as number[])

  function setColor(ptr: number, color: number) {
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
