@unmanaged
export class PlayerTrack {
  len: u32 = 0
  offset: i32 = 0
  coeff: f64 = 1.0

  floats_L$: usize = 0
  floats_R$: usize = 0
  floats_LR$: usize = 0

  out_L$: usize = 0
  out_R$: usize = 0
  out_LR$: usize = 0

  pan: f32 = 0
  vol: f32 = 1.0
}

@unmanaged
export class BarBox {
  timeBegin: f64 = 0.0
  pt$: usize = 0
}

@unmanaged
export class Out {
  L$: usize = 0
  R$: usize = 0
}
