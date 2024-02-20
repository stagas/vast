import wasm from 'assembly'
import { Struct } from 'utils'
import { createVm } from '../../generated/typescript/dsp-vm.ts'

const MAX_OPS = 4096

const SoundData = Struct({
  begin: 'i32',
  end: 'f32',
  pan: 'f32',
})

export function createDspController({
  sampleRate,
  core$
}: {
  sampleRate: number
  core$?: ReturnType<typeof wasm.createCore>
}) {
  core$ ??= wasm.createCore(sampleRate)
  const engine$ = wasm.createEngine(sampleRate, core$)

  function Dsp() {
    return wasm.createDsp()
  }

  function Sound() {
    const sound$ = wasm.createSound(engine$)
    const data$ = wasm.getSoundData(sound$)
    const data = SoundData(wasm.memory.buffer, +data$)
    const ops = wasm.alloc(Int32Array, MAX_OPS)
    const vm = createVm(+sound$, ops)
    return { sound$, data$, data, vm }
  }

  return { engine$, core$, Dsp, Sound }
}
