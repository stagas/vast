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