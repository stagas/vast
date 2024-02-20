import { logi } from '../../env'
import { Sample } from './sample'

export class Say extends Sample {
  text: i32 = 0

  _update(): void {
    this._floats = !this.text ? null : changetype<StaticArray<f32>>(this.text)
    super._update()
  }
}
