import { TypedArray, TypedArrayConstructor } from 'gl-util'
import { instantiate } from '../as/build/assembly.js'

const DEBUG = false

let mod: WebAssembly.Module

if (import.meta.env) {
  const hex = (await import('../as/build/assembly.wasm?raw-hex')).default
  const fromHexString = (hexString: string) => Uint8Array.from(
    hexString.match(/.{1,2}/g)!.map(byte =>
      parseInt(byte, 16)
    )
  )
  mod = await WebAssembly.compile(fromHexString(hex))
}
else {
  const url = (await import('../as/build/assembly.wasm?url')).default
  mod = await WebAssembly.compileStreaming(fetch(url))
}

const wasm = await instantiate(mod, {
  env: {
    logf: console.log,
    logf6: console.log,
  }
})

const reg = new FinalizationRegistry((ptr$: number) => {
  wasm.__unpin(ptr$)
  DEBUG && console.log('free', ptr$)
})

function alloc<T extends TypedArrayConstructor>(ctor: T, length: number) {
  const bytes = length * ctor.BYTES_PER_ELEMENT
  const ptr$ = wasm.__pin(wasm.__new(bytes, 1))
  const arr = new ctor(wasm.memory.buffer, ptr$, length)
  reg.register(arr, ptr$)
  return arr as TypedArray<T>
}

export default Object.assign(wasm, { alloc })

if (import.meta.vitest) {
  describe('alloc', () => {
    it('works', () => {
      const buf = alloc(Float32Array, 32)
      expect(buf.length).toBe(32)
      expect(buf).toBeInstanceOf(Float32Array)
    })
  })
}
