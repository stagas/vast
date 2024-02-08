/** @jsxImportSource signal-jsx */
import { add, doit } from 'assembly'
import { alloc } from '../util/alloc.ts'
import { $ } from 'signal-jsx'

export function Page() {
  const f32s = alloc(Float32Array, 32)
  const info = $({ clicked: 0 })
  window.onpointerdown = () => info.clicked++
  // setInterval(() => info.clicked++)
  return <div>From AssemblyScript malista:
    {add(1, 10)}
    {() => (
      info.clicked,
      doit(f32s.byteOffset),
      f32s.join(' '))}
  </div>
}
