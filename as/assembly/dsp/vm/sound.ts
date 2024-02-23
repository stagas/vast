import { MAX_FLOATS, MAX_LISTS, MAX_LITERALS, MAX_SCALARS } from '../constants'
import { Engine } from '../core/engine'
import { Gen } from '../gen/gen'
import { SoundData, SoundValueKind } from './dsp-shared'

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

  data: SoundData = new SoundData()

  get begin(): i32 {
    return this.data.begin
  }

  get end(): i32 {
    return this.data.end
  }

  set pan(v: f32) {
    this.data.pan = v
  }

  get pan(): f32 {
    return this.data.pan
  }

  gens: Gen[] = []
  offsets: usize[][] = []

  literals: StaticArray<f32> = new StaticArray<f32>(MAX_LITERALS)
  scalars: StaticArray<f32> = new StaticArray<f32>(MAX_SCALARS)
  audios: Array<StaticArray<f32> | null> = []
  lists: StaticArray<i32> = new StaticArray<i32>(MAX_LISTS)
  floats: StaticArray<i32> = new StaticArray<i32>(MAX_FLOATS)

  values: SoundValue[] = []

  reset(): void {
    this.gens.forEach(gen => {
      gen._reset()
    })
  }
}
