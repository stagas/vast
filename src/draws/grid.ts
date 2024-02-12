import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { ShapeKind, VertOpts } from '../../as/assembly/sketch-shared.ts'
import { Surface } from '../surface.ts'

const DEBUG = true

export type Grid = ReturnType<typeof Grid>

export function Grid(surface: Surface) {
  using $ = Signal()

  const { view, matrix, sketch } = surface

  // create Box data
  const ROWS = 30
  const COLS = 400
  const SCALE_X = 16

  const boxes = Boxes(ROWS, COLS, SCALE_X)

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
  }

  return { write }
}

function Boxes(rowsLength: number, cols: number, scaleX: number) {
  const rows = Array.from({ length: rowsLength }, (_, y) =>
    Array.from({ length: cols }, (_, x) =>
      [
        ShapeKind.Box,
        x * scaleX + Math.round(Math.random() * 4),
        y,
        1 + Math.round(Math.random() * 16), // w
        1, // h
        1, // lw
        1, // ptr
        0xdd0000 + 0x111111 * (Math.sin(y * 100) * 0.5 + 0.5), // color
        1.0 // alpha
      ]
    )
  )

  const data = new Float32Array(rows.flat(Infinity) as number[])

  return { rows, data }
}

function Waves(boxes: ReturnType<typeof Boxes>) {
  const floats = wasm.alloc(Float32Array, 44100)

  // const data = new Float32Array(
  //   Array.from({ length: rows }, (_, y) =>
  //     Array.from({ length: cols }, (_, x) =>
  //       [x * scaleX + Math.round(Math.random() * 4), y, 1 + Math.round(Math.random() * 16), 1, 1, 0xdd0000 + 0x111111 * Math.sin(y * 100) * 0.5, 1.0]
  //     ).flat()
  //   ).flat()
  // )
  // return data
}
