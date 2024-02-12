import { Signal } from 'signal-jsx'
import { VertOpts } from '../../as/assembly/sketch-shared.ts'
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
  const data = new Float32Array(
    Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: COLS }, (_, x) =>
        [x * SCALE_X + Math.round(Math.random() * 4), y, 1 + Math.round(Math.random() * 16), 1, 1, 0xdd0000 + 0x111111 * Math.sin(y * 100) * 0.5, 1.0]
      ).flat()
    ).flat()
  )

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
    sketch.write(VertOpts.Box, data)
  }

  return { write }
}
