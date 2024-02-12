import { logf } from './env'
import { Box, INSTANCE_LENGTH, MAX_GL_INSTANCES, Matrix, Sketch, VertOpts } from './sketch-shared'

export function draw(
  sketch$: usize,
  matrix$: usize,
  instances$: usize,

  width: f32,
  height: f32,

  begin: i32,
  end: i32,
): i32 {
  const sketch = changetype<Sketch>(sketch$)
  const a_opts = sketch.a_opts
  const a_vert$ = sketch.a_vert$
  const a_color$ = sketch.a_color$
  const range = sketch.range
  let ptr = range.end
  let rangeCount = range.count

  const m = changetype<Matrix>(matrix$)
  const ma: f32 = m.a
  const md: f32 = m.d
  const me: f32 = m.e
  const mf: f32 = m.f

  let x: f32 = 0
  let y: f32 = 0
  let w: f32 = 0
  let h: f32 = 0

  let box: Box

  let instance$: i32 = 0
  let opts: i32 = 0
  let ptr2: i32 = 0
  let ptr4: i32 = 0

  const x_gap: f32 = ma > 5 ? 1 : 0 //ma > .5 ? ma / 5 : 0

  for (let i = begin; i < end; i++) {
    instance$ = instances$ + ((i * INSTANCE_LENGTH) << 2)

    // read instance opts
    opts = i32(a_opts[ptr])

    //
    // Box
    //
    if (opts & VertOpts.Box) {
      box = changetype<Box>(instance$)

      x = box.x * ma + me
      y = box.y * md + mf
      w = box.w * ma - x_gap
      h = box.h * md - 1

      // check if visible
      if (x > width
        || y > height
        || x + w < 0
        || y + h < 0
      ) continue

      ptr4 = (ptr * 4) << 2
      put4(a_vert$ + ptr4, x, y, w, h)

      ptr2 = (ptr * 2) << 2
      put2(a_color$ + ptr2, box.color, box.alpha)

      ptr++
      rangeCount++

      if (rangeCount === MAX_GL_INSTANCES && (i + 1 < end)) {
        range.end = ptr
        range.count = rangeCount
        return i + 1
      }
      continue
    }
  } // end for

  range.end = ptr
  range.count = rangeCount
  return -1
}

// @ts-ignore
@inline
function put4(ptr: usize, x: f32, y: f32, z: f32, w: f32): void {
  f32.store(ptr, x)
  f32.store(ptr, y, 4)
  f32.store(ptr, z, 8)
  f32.store(ptr, w, 12)
}

// @ts-ignore
@inline
function put2(ptr: usize, x: f32, y: f32): void {
  f32.store(ptr, x)
  f32.store(ptr, y, 4)
}
