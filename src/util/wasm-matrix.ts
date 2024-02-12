import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { LerpMatrix } from './lerp-matrix.ts'

export type WasmMatrix = ReturnType<typeof WasmMatrix>

export function WasmMatrix(view: Rect, matrix: LerpMatrix) {
  using $ = Signal()

  const mat2d = wasm.alloc(Float32Array, 6)

  $.fx(() => {
    const { a, d, e, f } = matrix
    const { pr } = view
    $()
    mat2d.set(matrix.values)
  })

  return mat2d
}
