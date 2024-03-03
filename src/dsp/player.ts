import wasm from 'assembly'
import { Signal } from 'signal-jsx'
import { getMemoryView } from 'utils'
import { BUFFER_SIZE } from '../../as/assembly/dsp/constants.ts'
import { MAX_BARS } from '../../as/assembly/seq/constants.ts'
import { Out as OutType } from '../../as/assembly/seq/player-shared.ts'
import { Clock, Out, PlayerMode } from './player-shared.ts'
import type { PlayerProcessorOptions } from './player-worklet.ts'
import playerWorkletUrl from './player-worklet.ts?url'

export class PlayerNode extends AudioWorkletNode {
  constructor(
    context: AudioContext,
    player$: number,
    out$: number,
    sourcemapUrl: string,
    public mode = new Uint8Array(new SharedArrayBuffer(1))
  ) {
    super(context, 'player', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      processorOptions: <PlayerProcessorOptions>{
        sourcemapUrl,
        memory: wasm.memory,
        mode,
        player$,
        out$,
      }
    })
  }
  get isPlaying() {
    return this.mode[0] === PlayerMode.Play
  }
  start() {
    if (this.context.state === 'suspended') {
      (this.context as any).resume()
    }
    this.mode[0] = PlayerMode.Play
  }
  stop() {
    if (this.mode[0] === PlayerMode.Stop) {
      // this.dsp.resetClock()
    }
    else {
      this.mode[0] = PlayerMode.Stop
    }
  }
  reset() {
    this.mode[0] = PlayerMode.Reset
  }
  toggle() {
    if (this.isPlaying) this.stop()
    else this.start()
  }
}

export type Player = ReturnType<typeof Player>

export function Player(ctx: AudioContext) {
  using $ = Signal()
  const pin = <T>(x: T): T => { wasm.__pin(+x); return x }
  const view = getMemoryView(wasm.memory)
  const player$ = wasm.createPlayer(ctx.sampleRate)
  const clock$ = wasm.getPlayerClock(+player$)
  const clock = Clock(view.memory.buffer, clock$)
  const bars$ = wasm.getPlayerBars(player$)
  const bars = view.getU32(bars$, MAX_BARS)
  const out = Out(wasm.alloc(Uint8Array, Out.byteLength)) satisfies OutType
  const L = wasm.alloc(Float32Array, BUFFER_SIZE)
  const R = wasm.alloc(Float32Array, BUFFER_SIZE)
  out.L$ = L.ptr
  out.R$ = R.ptr
  const info = $({
    isPlaying: false,
    node: $.unwrap(() =>
      ctx.audioWorklet.addModule(playerWorkletUrl)
        .then(() => {
          const sourcemapUrl = new URL('/as/build/player.wasm.map', location.origin).href
          const node = new PlayerNode(ctx, +player$, out.ptr, sourcemapUrl)
          node.connect(ctx.destination)
          return node
        })
        .catch(console.error)
    ),
  })

  function start() {
    info.node?.start()
    info.isPlaying = info.node?.isPlaying ?? false
  }

  function stop() {
    info.node?.stop()
    info.isPlaying = info.node?.isPlaying ?? false
  }

  return { info, clock, bars, out: { view: out, L, R }, start, stop }
}
