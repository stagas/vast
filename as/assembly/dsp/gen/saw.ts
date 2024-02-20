import { Aosc } from './aosc'

export class Saw extends Aosc {
  get _tables(): StaticArray<StaticArray<f32>> {
    return this._engine.wavetable.antialias.saw
  }
}
