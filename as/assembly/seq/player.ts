import { Clock } from '../dsp/core/clock'
import { fadeIn16, fadeOut16 } from '../dsp/graph/fade'
import { mul_audio_scalar_add_audio1 } from '../dsp/graph/math'
import { logf2 } from '../env'
import { cubicMod, modWrap } from '../util'
import { MAX_BARS } from './constants'
import { BarBox, Out, PlayerTrack } from './player-shared'

type Bar = StaticArray<BarBox>

// @ts-ignore
@inline
function processTrack(track: PlayerTrack, index: f64, pos: i32): void {
  if (track.floats_L$) writeSamples(track.floats_L$, track.len, index, pos, track.out_L$)
  if (track.floats_R$) writeSamples(track.floats_R$, track.len, index, pos, track.out_R$)
  if (track.floats_LR$) writeSamples(track.floats_LR$, track.len, index, pos, track.out_LR$)
}

// @ts-ignore
@inline
function writeSamples(floats$: usize, length: u32, index: f64, pos: u32, out: usize): void {
  const floats = changetype<StaticArray<f32>>(floats$)
  const sample = cubicMod(floats, index, length)
  f32.store(out + (pos << 2), sample)
}

// @ts-ignore
@inline
function writeOut(track: PlayerTrack, pos: i32, out_L: usize, out_R: usize): void {
  const pan_L: f32 = Mathf.max(0, 1 - track.pan)
  const pan_R: f32 = Mathf.max(0, 1 + track.pan)

  let input: usize
  if (track.out_L$) {
    input = changetype<usize>(track.out_L$)
    mul_audio_scalar_add_audio1(input, pan_L, out_L, pos, out_L)
  }
  if (track.out_R$) {
    input = changetype<usize>(track.out_R$)
    mul_audio_scalar_add_audio1(input, pan_R, out_R, pos, out_R)
  }
  if (track.out_LR$) {
    input = changetype<usize>(track.out_LR$)
    mul_audio_scalar_add_audio1(input, pan_L, out_L, pos, out_L)
    mul_audio_scalar_add_audio1(input, pan_R, out_R, pos, out_R)
  }
}

export class Player {
  clock: Clock
  bars: StaticArray<Bar> = new StaticArray<Bar>(MAX_BARS)
  next: StaticArray<Bar> = new StaticArray<Bar>(MAX_BARS)
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
    const sampleRate = clock.sampleRate

    let pos: u32 = begin

    for (; pos < end; pos++) {
      // logi(pos)
      const time = clock.time
      const coeff = clock.coeff
      const barTime = clock.barTime
      const barIndex: i32 = i32(Math.floor(barTime))
      const bar: Bar | null = unchecked(bars[barIndex])
      if (bar) {
        let box: BarBox | null
        let i: i32 = 0
        while (unchecked(box = bar[i++])) {
          // logf2(f32(barTime), f32(box.timeBegin))
          // TODO: should adjust for bpm + track.coeff + track.offset
          const track = changetype<PlayerTrack>(box.pt$)
          const index: f64 = modWrap(((barTime - box.timeBegin) / coeff) * sampleRate, f64(track.len))
          processTrack(track, index, pos)
          writeOut(track, pos, out_L, out_R)
        }
      }
      clock.time = time + clock.timeStep
      clock.update()
    }
  }
}
