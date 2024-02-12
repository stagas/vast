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
      Array.from({ length: 20 }, (_, x) =>
        [x, y, 1, 1, 0xdd0000 + 0x111111 * Math.random() * 0.5, 1.0]
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

  const mat2d = WasmMatrix(matrix)

  // const boxes = Boxes(webgl.GL, surface.world, data)
  // webgl.add($, boxes)

  const quad = Quad(webgl.GL)
  webgl.add($, quad)

  const sketch = Sketch(webgl.GL, view, mat2d)
  webgl.add($, sketch)
  sketch.boxes.set(data)
  sketch.boxes.count = data.length / 6
  console.log(sketch.boxes.count)

  return surface.canvas
}

function WasmMatrix(matrix: LerpMatrix) {
  using $ = Signal()

  const mat2d = wasm.alloc(Float32Array, 6)
  $.fx(() => {
    const { a, d, e, f } = matrix
    $()
    mat2d.set(matrix.values)
    mat2d[4] *= window.devicePixelRatio
    mat2d[5] *= window.devicePixelRatio
  })

  return mat2d
}
