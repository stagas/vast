import { MAX_FLOATS, MAX_LISTS, MAX_LITERALS, MAX_SCALARS } from '../constants'
import { Engine } from '../core/engine'
import { Gen } from '../gen/gen'
import { SoundValueKind } from './dsp-shared'

export class SoundValue {
  constructor(
    public kind: SoundValueKind,
    public ptr: i32,
  ) { }
  scalar$: i32 = 0
  audio$: i32 = 0
}

export class Sound {
  constructor(public engine: Engine) { }

  gens: Gen[] = []
  offsets: usize[][] = []

  literals: StaticArray<f32> = new StaticArray<f32>(MAX_LITERALS)
  scalars: StaticArray<f32> = new StaticArray<f32>(MAX_SCALARS)
  audios: StaticArray<f32>[] = []
  lists: StaticArray<i32> = new StaticArray<i32>(MAX_LISTS)
  floats: StaticArray<i32> = new StaticArray<i32>(MAX_FLOATS)

  values: SoundValue[] = []

  pan: f32 = 0
  begin: i32 = 0
  end: i32 = 0

  reset(): void {
    this.gens.forEach(gen => {
      gen._reset()
    })
  }
}
