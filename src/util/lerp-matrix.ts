import { $, fn } from 'signal-jsx'
import { Matrix } from 'std'

export class LerpMatrix extends Matrix {
  dest = $(new Matrix)
  speed = 0.3
  threshold = .001
  @fn tick = () => {
    const { dest, speed, threshold } = this
    const da = dest.a - this.a
    // const db = dest.b - this.b
    // const dc = dest.c - this.c
    const dd = dest.d - this.d
    const de = dest.e - this.e
    const df = dest.f - this.f
    if (
      Math.abs(da) > threshold
      // || Math.abs(db) > threshold
      // || Math.abs(dc) > threshold
      || Math.abs(dd) > threshold
      || Math.abs(de) > threshold
      || Math.abs(df) > threshold
    ) {
      this.a += da * speed
      // this.b += db * speed
      // this.c += dc * speed
      this.d += dd * speed
      this.e += de * speed
      this.f += df * speed
    }
    else {
      this.a = dest.a
      // this.b = dest.b
      // this.c = dest.c
      this.d = dest.d
      this.e = dest.e
      this.f = dest.f
    }
  }
}
