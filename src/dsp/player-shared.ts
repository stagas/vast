import { Struct } from 'utils'

export const enum PlayerMode {
  Idle,
  Reset,
  Stop,
  Play,
}

export const Out = Struct({
  L$: 'usize',
  R$: 'usize',
})

export type Clock = typeof Clock.type

export const Clock = Struct({
  time: 'f64',
  timeStep: 'f64',
  prevTime: 'f64',
  endTime: 'f64',
  internalTime: 'f64',
  bpm: 'f64',
  coeff: 'f64',
  barTime: 'f64',
  barTimeStep: 'f64',
  nextBarTime: 'f64',
  loopStart: 'f64',
  loopEnd: 'f64',
  sampleRate: 'u32',
  jumpBar: 'i32',
  ringPos: 'u32',
  nextRingPos: 'u32',
})

export const PlayerTrack = Struct({
  len: 'u32',
  offset: 'i32',
  coeff: 'f64',
  floats_L$: 'usize',
  floats_R$: 'usize',
  floats_LR$: 'usize',
  out_L$: 'usize',
  out_R$: 'usize',
  out_LR$: 'usize',
  pan: 'f32',
  vol: 'f32',
})
