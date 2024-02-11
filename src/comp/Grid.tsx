import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { Boxes } from '../gl/boxes.ts'
import { Surface } from '../surface.ts'
import { Quad } from '../gl/quad.ts'
import { LerpMatrix } from '../util/lerp-matrix.ts'
import { Sketch } from '../gl/sketch.ts'

export function Grid() {
  using $ = Signal()

  const view = $(new Rect)
  const surface = Surface(view)
  const { webgl } = surface

  const ROWS = 8
  const data = new Float32Array(
    Array.from({ length: ROWS }, (_, y) =>
      Array.from({ length: 40 }, (_, x) =>
        [x, y, 1, 1]
      ).flat()
    ).flat()
  )

  const { matrix } = surface.world
  $.untrack(() => {
    if (matrix.a === 1) {
      matrix.a = matrix.dest.a = 50
      matrix.e = matrix.dest.e = 100 / window.devicePixelRatio
      matrix.d = matrix.dest.d = view.h / ROWS
    }
  })

  $.fx(() => {
    const { h } = view
    $()
    matrix.dest.d = h / ROWS
  })

  const mat3fv = WasmMatrix(matrix)

  // const boxes = Boxes(webgl.GL, surface.world, data)
  // webgl.add($, boxes)

  const quad = Quad(webgl.GL)
  webgl.add($, quad)

  const sketch = Sketch(webgl.GL, view)
  webgl.add($, sketch)

  return surface.canvas
}

function WasmMatrix(matrix: LerpMatrix) {
  using $ = Signal()

  const mat3fv = wasm.alloc(Float32Array, 9)
  $.fx(() => {
    const { a, d, e, f } = matrix
    $()
    mat3fv.set(matrix.values)
  })

  return mat3fv
}
