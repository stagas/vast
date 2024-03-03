import wasm from 'assembly-player'
import { Signal } from 'signal-jsx'
import { Dsp } from './dsp/dsp.ts'
import { Player } from './dsp/player.ts'

export type Audio = ReturnType<typeof Audio>

export function modWrap(x: number, N: number): number {
  return (x % N + N) % N
}

export function Audio() {
  using $ = Signal()

  const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 0.000001 })
  const dsp = Dsp(ctx)
  const player = Player(ctx)
  const bar = wasm.alloc(Uint32Array, 16)
  player.bars[0] = bar.ptr
  player.clock.bpm = 144
  wasm.updateClock(player.clock.ptr)

  const info = $({
    timeNow: 0,
    timeNowLerp: 0,
  })

  let initial = true

  function tick() {
    const now =
      player.clock.barTime
      - (
        player.info.isPlaying
          // compensate for the latency to the speakers
          // and our own lerp delay
          ? ctx.outputLatency - ctx.baseLatency + 0.020
          : 0
      )

    if (!initial || now >= 0) {
      initial = false

      info.timeNow = modWrap(now, 1)

      if (!info.timeNow || info.timeNow < info.timeNowLerp) {
        info.timeNowLerp = info.timeNow
      }
      else {
        info.timeNowLerp += (info.timeNow - info.timeNowLerp) * 0.4
      }
    }

    if (player.info.isPlaying) {
      return true
    }
    else {
      initial = true
    }
  }

  return { info, ctx, dsp, player, bar, tick }
}

export let audio = Audio()
