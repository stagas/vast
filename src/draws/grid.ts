import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { ShapeKind } from '../../as/assembly/sketch-shared.ts'
import { Surface } from '../surface.ts'
import { log } from '../state.ts'

const DEBUG = true

export type Grid = ReturnType<typeof Grid>

export function Grid(surface: Surface) {
  using $ = Signal()

  const { view, matrix, sketch } = surface

  // create Box data
  const ROWS = 30
  const COLS = 1200
  const SCALE_X = 4

  const boxes = Boxes(ROWS, COLS, SCALE_X)
  const waves = Waves(boxes)

  $.untrack(function initial_scale() {
    if (matrix.a === 1) {
      matrix.a = matrix.dest.a = view.w / (COLS * SCALE_X)
      matrix.d = matrix.dest.d = view.h / ROWS
    }
  })

  $.fx(function scale_rows_to_fit_height() {
    const { h } = view
    $()
    matrix.dest.d = h / ROWS
  })

  function write() {
    sketch.write(boxes.data)
    sketch.write(waves.data)
  }

  return { write }
}

function Boxes(rowsLength: number, cols: number, scaleX: number) {
  const rows = Array.from({ length: rowsLength }, (_, y) =>
    Array.from({ length: cols }, (_, x) =>
      [
        ShapeKind.Box,
        x * scaleX, //scaleX + Math.round(Math.random() * 4),
        y,
        scaleX, //1 + Math.round(Math.random() * 12), // w
        1, // h
        1, // lw
        1, // ptr
        0, // len
        0x770000 + 0x111111 * (Math.sin(y * 100) * 0.5 + 0.5), // color
        1.0 // alpha
      ] as [
        kind: ShapeKind.Box,
        x: number,
        y: number,
        w: number,
        h: number,
        lw: number,
        ptr: number,
        len: number,
        color: number,
        alpha: number,
      ]
    )
  )

  const data = new Float32Array(rows.flat(Infinity) as number[])

  return { rows, data }
}


const waveformLength = 2048
const waveform = Float32Array.from({ length: waveformLength }, (_, i) =>
  Math.sin((i * 100) / waveformLength * Math.PI * 2) // sine wave
  * (1 - (((i * 4) / waveformLength) % 1) ** .2) // envelope
)
let floats: Float32Array & { ptr: number }

function Waves(boxes: ReturnType<typeof Boxes>) {
  if (!floats) {
    // allocate wasm memory for the floats
    // and create mipmaps.
    const smallDivisor = 16
    const tinyDivisor = 4
    const steps = 2
    const smallCoeff = smallDivisor / steps
    const tinyCoeff = smallCoeff / tinyDivisor
    const smallLength = Math.floor(waveformLength / smallDivisor)
    const tinyLength = Math.floor(smallLength / tinyDivisor)

    const smallSize = smallLength * steps
    const tinySize = tinyLength * steps
    const pxSize = steps

    const smallPtr = waveformLength // distanced view
    const tinyPtr = smallPtr + smallSize // even more distanced
    const pxPtr = tinyPtr + tinySize // when < 1 pixel in width
    const size = pxPtr + pxSize

    floats = wasm.alloc(Float32Array, size)
    floats.set(waveform)

    for (let n = 0; n < smallLength; n++) {
      const n0 = Math.floor(n * smallCoeff)
      const n1 = Math.ceil((n + 1) * smallCoeff)

      let min = Infinity, max = -Infinity
      let s
      for (let i = n0; i < n1; i++) {
        s = waveform[i]
        if (s < min) min = s
        else if (s > max) max = s
      }
      if (!isFinite(min)) min = 0
      if (!isFinite(max)) max = 0

      const p = smallPtr + n * steps
      console.log('SMALL', floats.byteOffset + (p << 2))
      floats[p] = min
      floats[p + 1] = max
    }

    for (let n = 0; n < tinyLength; n++) {
      const n0 = Math.floor(n * tinyCoeff)
      const n1 = Math.ceil((n + 1) * tinyCoeff)

      let min = Infinity, max = -Infinity
      let s
      for (let i = n0; i < n1; i++) {
        s = waveform[i]
        if (s < min) min = s
        if (s > max) max = s
      }
      if (!isFinite(min)) min = 0
      if (!isFinite(max)) max = 0

      const p = tinyPtr + n * steps
      console.log('TINY', floats.byteOffset + (p << 2))
      floats[p] = min
      floats[p + 1] = max
    }

    {
      let min = Infinity, max = -Infinity
      let s
      for (let i = 0; i < waveformLength; i++) {
        s = waveform[i]
        if (s < min) min = s
        if (s > max) max = s
      }
      if (!isFinite(min)) min = 0
      if (!isFinite(max)) max = 0

      const p = pxPtr
      console.log('PX', floats.byteOffset + (p << 2))
      floats[p] = min
      floats[p + 1] = max

      console.log(min, max)
      console.log('small length', smallLength)
      console.log('tiny length', tinyLength)
    }
  }

  const data = new Float32Array(boxes.rows.map(cols =>
    cols.map(([, x, y, w, h]) =>
      [
        ShapeKind.Wave,
        x, y, w, h, // same dims as the box
        1, // lw
        floats.ptr, // ptr
        waveformLength, // len
        0x0, //0ffff, // color
        1.0, // alpha
      ] as [
        kind: ShapeKind.Wave,
        x: number,
        y: number,
        w: number,
        h: number,
        lw: number,
        ptr: number,
        len: number,
        color: number,
        alpha: number,
      ]
    ).flat()
  ).flat())

  return { data }
}
