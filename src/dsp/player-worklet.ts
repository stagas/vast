import { getMemoryView, toRing, wasmSourceMap } from 'utils'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'
import type { __AdaptedExports as WasmExports } from '../../as/build/seq-nort'
import hex from '../../as/build/seq-nort.wasm?raw-hex'
import { Clock } from './dsp-shared.ts'
import { Out, PlayerMode } from './player-shared.ts'

type AudioProcess = (inputs: Float32Array[], outputs: Float32Array[]) => void

export interface PlayerProcessorOptions {
  memory: WebAssembly.Memory
  mode: Uint8Array
  player$: number
  out$: number
  sourcemapUrl: string
}

async function createPlayerController(player: PlayerProcessor) {
  const { memory, mode, player$, out$, sourcemapUrl } = player.options.processorOptions

  const fromHexString = (hexString: string) => Uint8Array.from(
    hexString.match(/.{1,2}/g)!.map(byte =>
      parseInt(byte, 16)
    )
  )
  const uint8 = fromHexString(hex)
  const buffer = wasmSourceMap.setSourceMapURL(uint8.buffer, sourcemapUrl)
  const binary = new Uint8Array(buffer)

  const mod = await WebAssembly.compile(binary)
  const instance = await WebAssembly.instantiate(mod, {
    env: {
      abort: console.warn,
      log: console.log,
      memory,
    }
  })
  const wasm: typeof WasmExports = instance.exports as any

  const clock$ = wasm.getPlayerClock(player$)
  const clock = Clock(memory.buffer, clock$)

  const chunkSize = 128
  const view = getMemoryView(memory)

  const out = Out(memory.buffer, out$)
  const L = view.getF32(out.L$, BUFFER_SIZE)
  const R = view.getF32(out.R$, BUFFER_SIZE)

  const ring_L = toRing(L, chunkSize)
  const ring_R = toRing(R, chunkSize)

  let begin: number = 0
  let end: number = chunkSize

  const next = () => {
    clock.ringPos = clock.nextRingPos
    clock.nextRingPos = (clock.ringPos + 1) % ring_L.length
    begin = clock.ringPos * chunkSize
    end = (clock.ringPos + 1) * chunkSize
    ring_L[clock.ringPos].fill(0)
    ring_R[clock.ringPos].fill(0)

    wasm.updateClock(clock$)
  }

  let inputs: Float32Array[]
  let outputs: Float32Array[]

  const writeOutput = () => {
    outputs[0]?.set(ring_L[clock.ringPos])
    outputs[1]?.set(ring_R[clock.ringPos])
  }

  function setMode(m: PlayerMode) {
    mode[0] = m
  }

  const modes: { [K in PlayerMode]: () => void } = {
    [PlayerMode.Idle]() {
      wasm.playerProcess(player$, 0, 0, out$)
    },
    [PlayerMode.Reset]() {
      next()

      wasm.playerProcess(player$, begin, end, out$)
      writeOutput()

      // reset the clock so we start at 0
      wasm.resetClock(clock$)

      // last bar will be null, so play will do fade ins
      wasm.clearLastBar(player$)

      setMode(PlayerMode.Play)
    },
    [PlayerMode.Stop]() {
      next()

      wasm.playerProcess(player$, begin, end, out$)
      writeOutput()

      // reset the clock so we start at 0
      wasm.resetClock(clock$)

      // last bar will be null, so play will do fade ins
      wasm.clearLastBar(player$)

      setMode(PlayerMode.Idle)
    },
    [PlayerMode.Play]() {
      next()
      wasm.playerProcess(player$, begin, end, out$)
      writeOutput()
    },
    [PlayerMode.Pause]() {
      next()

      wasm.playerProcess(player$, begin, end, out$)
      writeOutput()

      // last bar will be null, so play will do fade ins
      wasm.clearLastBar(player$)

      setMode(PlayerMode.Idle)
    },
  }

  const controller: { player$: number, process: AudioProcess } = {
    player$,
    process: (_inputs, _outputs) => {
      inputs = _inputs
      outputs = _outputs
      modes[<PlayerMode>mode[0]]()
    }
  }

  return controller
}

export class PlayerWorklet {
  controller?: Awaited<ReturnType<typeof createPlayerController>>

  process: AudioProcess = () => { }

  async init(player: PlayerProcessor) {
    this.controller = await createPlayerController(player)
    this.process = this.controller.process
  }
}

export class PlayerProcessor extends AudioWorkletProcessor {
  player: PlayerWorklet = new PlayerWorklet()

  constructor(public options: { processorOptions: PlayerProcessorOptions }) {
    super()
    this.player.init(this).then(() => console.log('[worklet] ready'))
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    this.player.process(inputs[0], outputs[0])
    return true
  }
}

registerProcessor('player', PlayerProcessor)
