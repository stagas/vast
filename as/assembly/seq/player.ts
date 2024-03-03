import { Clock } from '../dsp/core/clock'
import { fadeIn, fadeOut } from '../dsp/graph/fade'
import { mul_audio_scalar_add_audio } from '../dsp/graph/math'
import { logi } from '../env'
import { cubicMod, modWrap } from '../util'
import { MAX_BARS } from './constants'
import { Out, PlayerTrack } from './player-shared'

type Bar = StaticArray<PlayerTrack>

// @ts-ignore
@inline
function processTrack(track: PlayerTrack, index: f64, step: f64, begin: i32, end: i32): void {
  if (track.floats_L$) writeSamples(track.floats_L$, track.len, index, step, begin, end, track.out_L$)
  if (track.floats_R$) writeSamples(track.floats_R$, track.len, index, step, begin, end, track.out_R$)
  if (track.floats_LR$) writeSamples(track.floats_LR$, track.len, index, step, begin, end, track.out_LR$)
}

// @ts-ignore
@inline
function hasTrack(bar: Bar, track: PlayerTrack): boolean {
  let i: i32 = 0
  let t: PlayerTrack | null
  while (unchecked(t = bar[i++])) {
    if (t === track) return true
  }
  return false
}

// @ts-ignore
@inline
function writeSamples(floats$: usize, length: u32, index: f64, step: f64, begin: u32, end: u32, out: usize): void {
  const floats = changetype<StaticArray<f32>>(floats$)
  if (!floats) return

  let sample: f32
  let i: u32 = begin

  out += begin << 2

  for (; i < end; i += 16) {
    unroll(16, () => {
      sample = cubicMod(floats, index, length)
      f32.store(out, sample)
      out += 4
      index += step
    })
  }
}

// @ts-ignore
@inline
function writeOut(track: PlayerTrack, begin: i32, end: i32, out_L: usize, out_R: usize): void {
  const pan_L: f32 = Mathf.max(0, 1 - track.pan)
  const pan_R: f32 = Mathf.max(0, 1 + track.pan)

  let input: usize
  if (track.out_L$) {
    input = changetype<usize>(track.out_L$)
    mul_audio_scalar_add_audio(input, pan_L, out_L, begin, end, out_L)
  }
  if (track.out_R$) {
    input = changetype<usize>(track.out_R$)
    mul_audio_scalar_add_audio(input, pan_R, out_R, begin, end, out_R)
  }
  if (track.out_LR$) {
    input = changetype<usize>(track.out_LR$)
    mul_audio_scalar_add_audio(input, pan_L, out_L, begin, end, out_L)
    mul_audio_scalar_add_audio(input, pan_R, out_R, begin, end, out_R)
  }
}

// @ts-ignore
@inline
function fadeOutTrack(track: PlayerTrack, samples: u32, begin: i32, end: i32): void {
  let input: usize

  if (track.out_L$) {
    input = changetype<usize>(track.out_L$)
    fadeOut(samples, begin, end, input)
  }
  if (track.out_R$) {
    input = changetype<usize>(track.out_R$)
    fadeOut(samples, begin, end, input)
  }
  if (track.out_LR$) {
    input = changetype<usize>(track.out_LR$)
    fadeOut(samples, begin, end, input)
  }
}

// @ts-ignore
@inline
function fadeInTrack(track: PlayerTrack, samples: u32, begin: i32, end: i32): void {
  let input: usize

  if (track.out_L$) {
    input = changetype<usize>(track.out_L$)
    fadeIn(samples, begin, end, input)
  }
  if (track.out_R$) {
    input = changetype<usize>(track.out_R$)
    fadeIn(samples, begin, end, input)
  }
  if (track.out_LR$) {
    input = changetype<usize>(track.out_LR$)
    fadeIn(samples, begin, end, input)
  }
}

class Player {
  clock: Clock
  bars: StaticArray<Bar> = new StaticArray<Bar>(MAX_BARS)
  last: Bar | null = null
  constructor(public sampleRate: u32) {
    const clock = new Clock()
    this.clock = clock
    clock.sampleRate = sampleRate
    clock.update()
    clock.reset()
  }
  process(begin: u32, end: u32, out$: usize): void {
    const out = changetype<Out>(out$)
    const out_L = out.L$
    const out_R = out.R$
    const bars = this.bars
    const clock: Clock = this.clock
    const sampleRate: f32 = f32(clock.sampleRate)
    const time: f32 = f32(clock.time)
    const barTime: f32 = f32(clock.barTime)
    const coeff: f32 = f32(clock.coeff)
    const currBarIndex: i32 = i32(Math.floor(clock.barTime))
    const nextBarIndex: i32 = i32(Math.floor(clock.nextBarTime))
    const curr: Bar | null = bars[currBarIndex]
    if (!curr) return
    const next: Bar | null = nextBarIndex >= 0 ? bars[nextBarIndex] : null
    const last: Bar | null = this.last

    let track: PlayerTrack | null
    let i: i32 = 0
    // logi(i)
    while (unchecked(track = curr[i++])) {
      // logi(i32(track.floats_LR$))
      // if (!last || !hasTrack(last, track)) {
      //   // track.reset()
      // }
      // TODO: should adjust for bpm + coeff
      const index: f64 = modWrap(time * sampleRate, track.len)
      const step: f64 = 1.0
      processTrack(track, index, step, begin, end)
    }

    // bar transitions

    // x ? ?
    // We have been playing a bar.
    if (last) {
      // x x ?
      // We will play the same bar.
      if (last === curr) {
        // x x x
        // The next bar is the same, no transitions.
        if (curr === next) {
          // logi(111)
          i = 0
          while (unchecked(track = curr[i++])) {
            writeOut(track, begin, end, out_L, out_R)
          }
        }
        // x x ?
        // Next bar is different, do transitions.
        else {
          // logi(112)
          i = 0
          while (unchecked(track = curr[i++])) {
            if (!next || !hasTrack(next, track)) {
              fadeOutTrack(track, 128, begin, end)
            }
            writeOut(track, begin, end, out_L, out_R)
          }
        }
      }
      // x y ?
      // We will play a different bar.
      else {
        if (last) {
          // fade out last bar's tracks that no longer play in the curr bar
          i = 0
          while (unchecked(track = last[i++])) {
            if (!hasTrack(curr, track)) {
              // globals
              // track.sound.scalars[0] = sampleRate
              // track.sound.scalars[1] = time
              // track.sound.scalars[2] = barTime
              // track.sound.scalars[3] = coeff
              // track.sound.process(track.vm, begin, end)

              fadeOutTrack(track, 128, begin, end)
              writeOut(track, begin, end, out_L, out_R)
            }
          }
        }
        // x y y
        // The new bar is the same as the next.
        if (curr === next) {
          // logi(122)
          i = 0
          while (unchecked(track = curr[i++])) {
            if (!hasTrack(last, track)) {
              fadeInTrack(track, 32, begin, end)
            }
            writeOut(track, begin, end, out_L, out_R)
          }
        }
        // x y z
        // The next bar is different, this is the case
        // where we navigate at the last bar right before
        // the loop.
        else {
          // logi(123)
          i = 0
          while (unchecked(track = curr[i++])) {
            if (!hasTrack(last, track)) {
              fadeInTrack(track, 8, begin, end)
            }
            if (!next || !hasTrack(next, track)) {
              fadeOutTrack(track, 128, begin, end)
            }
            writeOut(track, begin, end, out_L, out_R)
          }
        }
      }
    }
    // - ? ?
    // We are just starting.
    else {
      // - x x
      // The new bar is the same as the next.
      if (curr === next) {
        // logi(811)
        i = 0
        while (unchecked(track = curr[i++])) {
          fadeInTrack(track, 32, begin, end)
          writeOut(track, begin, end, out_L, out_R)
        }
      }
      // - x y
      // The next bar is different, this is the case
      // where we navigate at the last bar right before
      // the loop.
      else {
        // logi(812)
        i = 0
        while (unchecked(track = curr[i++])) {
          fadeInTrack(track, 32, begin, end)
          if (!next || !hasTrack(next, track)) {
            fadeOutTrack(track, 128, begin, end)
          }
          writeOut(track, begin, end, out_L, out_R)
        }
      }
    }

    clock.time += f64(end - begin) / f64(clock.sampleRate)

    this.last = curr
  }
}

export function createPlayer(sampleRate: u32): Player {
  return new Player(sampleRate)
}

export function getPlayerBars(player: Player): usize {
  return changetype<usize>(player.bars)
}

export function getPlayerClock(player$: usize): usize {
  const player = changetype<Player>(player$)
  return changetype<usize>(player.clock)
}

export function resetClock(clock$: usize): void {
  const clock = changetype<Clock>(clock$)
  clock.reset()
}

export function updateClock(clock$: usize): void {
  const clock = changetype<Clock>(clock$)
  clock.update()
}

export function playerProcess(player$: usize, begin: u32, end: u32, out$: usize): void {
  const player = changetype<Player>(player$)
  player.process(begin, end, out$)
}

export function clearLastBar(player$: usize): void {
  const player = changetype<Player>(player$)
  player.last = null
}
