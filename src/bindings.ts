import { TypedArray, TypedArrayConstructor } from 'gl-util'
import { instantiate } from '../as/build/assembly.js'
import { log } from './state.ts'

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

let flushSketchFn = () => {}
function setFlushSketchFn(fn: () => void) {
  flushSketchFn = fn
}

const wasm = await instantiate(mod, {
  env: {
    log: console.log,
    flushSketch() {
      flushSketchFn()
    }
  }
})

const reg = new FinalizationRegistry((ptr: number) => {
  try {
    wasm.__unpin(ptr)
    lru.delete(ptr)
    DEBUG && console.log('free', ptr)
  }
  catch (error) {
    console.error('Failed free:', ptr, error)
  }
})

let lru = new Set<number>()
const TRIES = 16

function alloc<T extends TypedArrayConstructor>(ctor: T, length: number) {
  const bytes = length * ctor.BYTES_PER_ELEMENT

  do {
    try {
      const ptr = wasm.__pin(wasm.__new(bytes, 1))
      const arr = new ctor(wasm.memory.buffer, ptr, length)
      const unreg = {}
      reg.register(arr, ptr, unreg)
      return Object.assign(arr as TypedArray<T>, {
        ptr,
        free() {
          reg.unregister(unreg)
          wasm.__unpin(ptr)
          lru.delete(ptr)
        }
      })
    }
    catch (err) {
      console.error(err)
      console.error('Failed alloc:', bytes, ' - will attempt to free memory.')
      const [first, ...rest] = lru
      lru = new Set(rest)
      wasm.__unpin(first)
      continue
    }
  } while (lru.size)

  //
  // NOTE: We can't allocate any wasm memory.
  //  This is a catastrophic error so we choose to _refresh_ the page.
  //  Might not be ideal in all situations.
  // We shouldn't refresh if the failure is right after a new refresh,
  // otherwise we enter into infinite refreshes loop.
  if (+new Date() - +new Date(performance.timeOrigin) > 10_000) {
    location.href = location.href
  }

  throw new Error('Cannot allocate wasm memory.')
}

export default Object.assign(wasm, { alloc, setFlushSketchFn })

if (import.meta.vitest) {
  describe('alloc', () => {
    it('works', () => {
      const buf = alloc(Float32Array, 32)
      expect(buf.length).toBe(32)
      expect(buf).toBeInstanceOf(Float32Array)
    })
  })
}
