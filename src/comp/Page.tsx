/** @jsxImportSource signal-jsx */
import { add } from '../as/build/assembly.js'

export function Page() {
  return <div>yo {add(1,2)}</div>
}
