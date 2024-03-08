import { $, fn } from 'signal-jsx'
import { Matrix, MatrixLike, PointLike, RectLike } from 'std'
import { log } from '../state.ts'
import { clamp } from 'utils'

export class LerpMatrix extends Matrix {
  dest = $(new Matrix)
  isRunning = false
  speed = 0.3
  threshold = .001
  minScale = {
    x: 0.01,
    y: 0.01,
  }
  maxScale = {
    x: 64000,
    y: 64000,
  }
  @fn tick = () => {
    const { dest, speed, threshold } = this
    this.isRunning = lerpMatrix(this, dest, this.minScale, this.maxScale, speed, threshold)
  }
}

export function lerpMatrix(
  src: MatrixLike,
  dst: MatrixLike,
  minScale: PointLike,
  maxScale: PointLike,
  t = 0.3,
  threshold = .001
) {
  const da = dst.a - src.a
  const db = dst.b - src.b
  const dc = dst.c - src.c
  const dd = dst.d - src.d
  const de = dst.e - src.e
  const df = dst.f - src.f
  const newScaleX = clamp(minScale.x, maxScale.x, src.a + da * t)
  const newScaleY = clamp(minScale.y, maxScale.y, src.d + dd * t)
  if (
    !(
      newScaleX === minScale.x ||
      newScaleX === maxScale.x ||
      newScaleY === minScale.y ||
      newScaleY === maxScale.y
    )
    && (
      Math.abs(da) > threshold ||
      Math.abs(db) > threshold ||
      Math.abs(dc) > threshold ||
      Math.abs(dd) > threshold ||
      Math.abs(de) > threshold ||
      Math.abs(df) > threshold
    )
  ) {
    src.a = newScaleX
    src.b += db * t
    src.c += dc * t
    src.d = newScaleY
    src.e += de * t
    src.f += df * t
    return true
  }
  else {
    src.a = dst.a
    src.b = dst.b
    src.c = dst.c
    src.d = dst.d
    src.e = dst.e
    src.f = dst.f
    return false
  }
}

export function transformMatrixPoint(m: Matrix, p: PointLike, t: PointLike) {
  const { a, b, c, d, e, f } = m
  const { x, y } = p
  t.x = a * x + c * y + e
  t.y = b * x + d * y + f
  return t
}

export function transformMatrixRect(m: Matrix, p: RectLike, t: RectLike) {
  const { a, b, c, d, e, f } = m
  const { x, y, w, h } = p
  t.x = a * x + c * y + e
  t.y = b * x + d * y + f
  t.w = a * w + c * h
  t.h = b * w + d * h
  return t
}
