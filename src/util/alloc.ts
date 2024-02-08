import wasm from 'assembly'

const typedArrayConstructors = [
  Uint8Array,
  Uint16Array,
  Uint32Array,
  BigUint64Array,
  Int8Array,
  Int16Array,
  Int32Array,
  BigInt64Array,
  Float32Array,
  Float64Array,
]

type TypedArrayConstructor = typeof typedArrayConstructors[0]

const reg = new FinalizationRegistry((ptr$: number) => {
  wasm.__unpin(ptr$)
  console.log('freed', ptr$)
})

export function alloc<T extends TypedArrayConstructor>(ctor: T, length: number) {
  const bytes = length * ctor.BYTES_PER_ELEMENT
  const ptr$ = wasm.__pin(wasm.__new(bytes, 1))
  const arr = new ctor(wasm.memory.buffer, ptr$, length)
  reg.register(arr, ptr$)
  return arr as InstanceType<T>
}
