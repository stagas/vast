import wasm from 'assembly-seq'
import { Signal } from 'signal-jsx'
import { getMemoryView } from 'utils'
import { BUFFER_SIZE, MAX_TRACKS } from '../../as/assembly/dsp/constants.ts'
import { MAX_BARS } from '../../as/assembly/seq/constants.ts'
import { Out as OutType } from '../../as/assembly/seq/player-shared.ts'
import { state } from '../state.ts'
import { Clock } from './dsp-shared.ts'
import { Out, PlayerMode } from './player-shared.ts'
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
    if (this.isPlaying) {
      this.mode[0] = PlayerMode.Stop
    }
    else {
      // this.dsp.resetClock()
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

  let bars$ = wasm.getPlayerBars(player$)
  let bars = Array.from({ length: MAX_BARS }, () => wasm.alloc(Uint32Array, MAX_TRACKS))
  const barsData = view.getU32(bars$, MAX_BARS)
  barsData.set(bars.map(bar => bar.ptr))

  let next$ = wasm.getPlayerNext(player$)
  let next = Array.from({ length: MAX_BARS }, () => wasm.alloc(Uint32Array, MAX_TRACKS))
  const nextData = view.getU32(next$, MAX_BARS)
  nextData.set(next.map(bar => bar.ptr))

  function swapBars() {
    [
      bars$, bars,
      next$, next
    ] = [
        next$, next,
        bars$, bars
      ]
    wasm.swapBars(player$)
  }

  const out = Out(wasm.memory.buffer, wasm.createOut()) satisfies OutType
  const L = wasm.alloc(Float32Array, BUFFER_SIZE)
  const R = wasm.alloc(Float32Array, BUFFER_SIZE)
  out.L$ = L.ptr
  out.R$ = R.ptr

  const info = $({
    isPlaying: false,
    node: $.unwrap(() =>
      ctx.audioWorklet.addModule(playerWorkletUrl)
        .then(() => {
          const sourcemapUrl = new URL('/as/build/player-nort.wasm.map', location.origin).href
          const node = new PlayerNode(ctx, +player$, out.ptr, sourcemapUrl)
          node.connect(ctx.destination)
          return node
        })
        .catch(console.error)
    ),
  })

  $.fx(() => {
    const { tracks } = state
    for (const t of tracks) {
      for (const b of t.info.boxes) {
        b.data.time
        b.data.length
      }
    }
    $()
    for (const bar of next) {
      bar.fill(0)
    }
    for (const t of tracks) {
      for (const { data: box } of t.info.boxes) {
        for (let x = box.time; x < box.time + box.length; x++) {
          const bar = next[x]
          bar[bar.indexOf(0)] = t.pt.ptr
        }
      }
    }
    swapBars()
  })

  function start() {
    info.node?.start()
    info.isPlaying = info.node?.isPlaying ?? false
  }

  function stop() {
    info.node?.stop()
    requestAnimationFrame(() => {
      info.isPlaying = info.node?.isPlaying ?? false
    })
  }

  return { info, clock, barsData, bars, out: { view: out, L, R }, start, stop }
}
