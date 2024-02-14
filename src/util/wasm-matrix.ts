import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { log } from '../state.ts'

export type WasmMatrix = ReturnType<typeof WasmMatrix>

export function WasmMatrix(view: Rect, matrix: Matrix) {
  using $ = Signal()

  const mat2d = wasm.alloc(Float64Array, 6)

  $.fx(() => {
    const { a, d, e, f } = matrix
    const { pr } = view
    $()
    mat2d.set(matrix.values)
    log(a)
  })

  return mat2d
}
