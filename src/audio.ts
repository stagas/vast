import wasm from 'assembly-player'
import { Signal } from 'signal-jsx'
import { Dsp } from './dsp/dsp.ts'
import { Player } from './dsp/player.ts'
import type { Project } from './dsp/project.ts'

export type Audio = ReturnType<typeof Audio>

export function modWrap(x: number, N: number): number {
  return (x % N + N) % N
}

export function Audio() {
  using $ = Signal()

  const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 0.000001 })
  const dsp = Dsp(ctx)
  const player = Player(ctx)

  function resetClock() {
    wasm.resetClock(player.clock.ptr)
    info.timeNow = info.timeNowLerp = player.clock.barTime
  }

  function setBpm(bpm: number) {
    player.clock.bpm = bpm
    wasm.updateClock(player.clock.ptr)
  }

  setBpm(144)

  const info = $({
    timeNow: 0,
    timeNowLerp: 0,
  })

  let initial = true

  function tick() {
    const c = player.clock

    const time = c.barTime

    const now =
      c.barTime
      - (
        player.info.isPlaying || (time !== c.startTime)
          // compensate for the latency to the speakers
          // and our own lerp delay
          ? ctx.outputLatency - 0.050
          : 0
      )

    if (!initial || now >= c.startTime) {
      initial = false

      info.timeNow = c.startTime + modWrap(now - c.startTime, c.endTime - c.startTime)

      if (info.timeNow === c.startTime || info.timeNow < info.timeNowLerp) {
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

  return { info, ctx, dsp, player, tick, resetClock }
}

export let audio = Audio()
