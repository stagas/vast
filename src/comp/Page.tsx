/** @jsxImportSource signal-jsx */
import wasm from 'assembly'
import { $ } from 'signal-jsx'
import { alloc } from '../util/alloc.ts'

export function Page() {
  const f32s = alloc(Float32Array, 32)
  const info = $({ clicked: 0 })
  window.onpointerdown = () => info.clicked++
  // setInterval(() => info.clicked++)
  return <div>From AssemblyScript malista:
    {wasm.add(1, 10)}
    {() => (
      info.clicked,
      wasm.doit(f32s.byteOffset),
      f32s.join(' '))}
  </div>
}
