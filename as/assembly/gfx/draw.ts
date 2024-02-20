import { logf, logf2, logf3, logf4, logf6 } from '../env'
import { Sketch } from './sketch-class'
import { Box, SHAPE_LENGTH, MAX_GL_INSTANCES, Matrix, VertOpts, Wave, ShapeOpts, Shape, Line } from './sketch-shared'
import { Floats } from '../util'

export function draw(
  sketch$: usize,

  matrix$: usize,
  width: f32,
  height: f32,

  begin: i32,
  end: i32,
): i32 {
  const sketch = changetype<Sketch>(sketch$)
  const range = sketch.range
  const shapes$ = sketch.shapes$

  let ptr = range.end
  let count = range.count

  const m = changetype<Matrix>(matrix$)
  const ma: f64 = m.a
  const md: f64 = m.d
  const me: f64 = m.e
  const mf: f64 = m.f

  // shapes
  let box: Box
  let line: Line
  let wave: Wave

  // let wave_step: f32 = Mathf.max(0.01, Mathf.min(1.0, .005 * ma ** 1.1))
  // logf(wave_step)
  const x_gap: f32 = ma > 5 ? 1 : 0 //ma > .5 ? ma / 5 : 0

  for (let i = begin, next_i: i32; i < end; i = next_i) {
    next_i = i + 1

    const shape$ = shapes$ + ((i * SHAPE_LENGTH) << 2)
    const opts = i32(changetype<Shape>(shape$).opts)

    switch (opts & 0b1111_1111) {
      //
      // Box
      //
      case ShapeOpts.Box: {
        box = changetype<Box>(shape$)

        const x = f32(box.x * ma + me)
        const y = f32(box.y * md + mf)
        const w = f32(box.w * ma - x_gap)
        let h = f32(box.h * md)
        if ((!(opts & ShapeOpts.Collapse) || h > 1.5) && h > 1.5) h -= h > 3 ? 1.0 : h > 1.5 ? .5 : 0

        // check if visible
        if (x > width
          || y > height
          || x + w < 0
          || y + h < 0
        ) continue

        // draw box
        sketch.putBox(
          ptr,
          x, y, w, h,
          box.color, box.alpha
        )

        ptr++
        count++

        // did we reach the limit before the end?
        if (count === MAX_GL_INSTANCES && next_i < end) {
          range.end = ptr
          range.count = count
          return next_i // we've drawn this shape, go to next shape in the next iteration
        }
        continue
      }

      //
      // Line
      //
      case ShapeOpts.Line: {
        line = changetype<Line>(shape$)

        const x0 = f32(line.x0 * ma + me)
        const y0 = f32(line.y0 * md + mf)
        const x1 = f32(line.x1 * ma + me)
        const y1 = f32(line.y1 * md + mf)

        // check if visible
        if (
          (
            x0 > width ||
            y0 > height ||
            x0 < 0 ||
            y0 < 0
          ) && (
            x1 > width ||
            y1 > height ||
            x1 < 0 ||
            y1 < 0
          )
        ) continue

        // draw box
        sketch.putLine(
          ptr,
          x0, y0,
          x1, y1,
          line.color, line.alpha,
          line.lw,
        )

        ptr++
        count++

        // did we reach the limit before the end?
        if (count === MAX_GL_INSTANCES && next_i < end) {
          range.end = ptr
          range.count = count
          return next_i // we've drawn this shape, go to next shape in the next iteration
        }
        continue
      }

      //
      // Wave
      //
      case ShapeOpts.Wave: {
        // continue
        wave = changetype<Wave>(shape$)

        const x = f32(wave.x * ma + me)
        const y = f32(wave.y * md + mf)
        const w = f32(wave.w * ma - x_gap)
        const h = f32(wave.h * md - 1)

        // check if visible
        if (x > width
          || y > height
          || x + w < 0
          || y + h < 0
        ) continue

        // const w_step: f32 = f32(.0025 * (ma ** .85))
        let x_step: f32 = Mathf.max(0.05, Mathf.min(1.0, f32(0.005 * ma))) //Mathf.max(0.9, Mathf.min(1.0, w_step))

        //
        // determine sampling coeff based on
        // the horizontal zoom level (m.a).
        //
        const MAX_ZOOM: f32 = 4
        const BASE_SAMPLES: f32 = 2048
        const NUM_SAMPLES: f32 = BASE_SAMPLES / MAX_ZOOM
        const sample_coeff: f32 = f32(NUM_SAMPLES / ma)
        let coeff: f32 = sample_coeff / (1.0 / x_step)

        // logf2(x_step, coeff)

        //
        // setup wave pointers
        //
        let p = i32(wave.ptr)
        let p_index: i32 = 0
        let n: f32 = 0
        let n_len = wave.len

        if (ma < 10) {
          p_index += i32(wave.len)
          n_len = Mathf.floor(wave.len / 16.0)

          if (ma < 2) {
            p_index += i32(n_len * 2.0)
            n_len = Mathf.floor(((wave.len / 16.0) * 2.0) / 4.0)

            if (ma < 1) {
              p_index += i32(n_len)
              // logf(111)
              x_step = 1
              coeff = 1
              n_len = 2
            }
            else {
              // logf(222)
              x_step **= 1.5
              // x_step = .01
              x_step = Mathf.max(0.0085, x_step)
              coeff = sample_coeff / (8.0 / x_step)
              // logf2(x_step, coeff)
            }
          }
          else {
            // logf(333)
            x_step **= 1.5
            x_step = Mathf.max(0.03, x_step)
            coeff = sample_coeff / (4.0 / x_step)
          }

          p += p_index << 2
        }

        // logf(f32(p))
        // logf(f32(ma))
        // logf2(n_coeff, n_step)

        let right = x + w

        //
        // determine left edge (cx)
        //
        let cx: f32 = x
        let ox: f32 = 0
        // if left edge is offscreen
        if (x < 0) {
          ox = -x
          cx = 0
        }

        //
        // determine width (cw)
        //
        let cw: f32 = w
        let ow: f32 = 0
        // if right edge if offscreen
        if (right > width) {
          // logf(444)
          ow = right - width
          cw = width - cx
          right = width
        }
        // or if left edge is offscreen
        else if (x < 0) {
          cw -= ox
        }

        // if (cw <= 1.0) {
        //   x_step = .15
        // }

        let steps = i32(cw / x_step)
        if (steps > i32(width) && ma > 100) {
          // logf2(666, f32(ma))
          coeff *= 1 / x_step
          x_step = 1
          steps = i32(cw)
        }
        // logf(f32(coeff))
        // logf(f32(cw))
        // logf4(f32(steps), x_step, cx, cw)
        // do we have enough lines to draw?
        if (count + steps >= MAX_GL_INSTANCES) {
          range.end = ptr
          range.count = count
          return i // repeat this shape in the next iteration
        }

        const hh: f32 = h / 2

        // advance the pointer if left edge is offscreen
        if (ox) {
          n += ox / x_step // 2.0 // TODO: why / 2.0 ? found by chance
        }

        const n_step = coeff

        if (x_step === 1 && ma < 10) {
          // n = 0
          let nx: f32 = 0 //(n * coeff) % n_len
          let s = f32.load(p + (i32(nx) << 2))

          // move to v0
          // let x0 = cx
          let y0 = y + hh + s * hh // TODO: hh in shader?

          // cx += x_step
          nx += n_step

          s = f32.load(p + (i32(nx) << 2))
          // logf(s)
          // let x1 = cx //+ x_step
          const y1 = y + hh + s * hh

          do {
            sketch.putLine(
              ptr,
              cx, y0,
              cx, y1,
              wave.color, wave.alpha,
              1.0
            )

            ptr++
            count++

            cx += 1.0
          } while (cx < right)
        }
        else if (n_step > x_step * 4.0) {
          // logf(66666)
          // read first sample
          let nx = (n * coeff) % n_len
          let s = f32.load(p + (i32(nx) << 2))

          // move to v0
          let x0 = cx
          let y0 = y + hh + s * hh // TODO: hh in shader?

          // draw for every pixel step
          right -= 1

          const lw: f32 = 1.4 + f32(x_step * 0.85)
          // logf(lw)

          do {
            cx += x_step
            nx += n_step

            s = f32.load(p + (i32(nx) << 2))
            // logf(s)
            const x1 = cx + x_step
            const y1 = y + hh + s * hh

            sketch.putLine(
              ptr,
              x0, y0,
              x1, y1,
              wave.color, wave.alpha,
              lw
            )

            ptr++
            count++

            if (nx >= n_len) nx -= n_len

            x0 = x1
            y0 = y1
          } while (cx < right)
        }
        else {
          // logf(777777)
          // interpolate 2 samples
          let nx = (n * coeff) % n_len
          // logf(nx)
          let nfrac = nx - Mathf.floor(nx)
          let s = readSampleLerp(p, nx, nfrac)

          // move to v0
          let x0 = cx
          let y0 = y + hh + s * hh // TODO: hh in shader?

          // draw for every pixel step
          // right -= 2

          do {
            cx += x_step
            nx += n_step

            nfrac = nx - Mathf.floor(nx)
            s = readSampleLerp(p, nx, nfrac)

            const x1 = cx + x_step
            const y1 = y + hh + s * hh

            sketch.putLine(
              ptr,
              x0, y0,
              x1, y1,
              wave.color, wave.alpha,
              1.5
            )

            ptr++
            count++

            if (nx >= n_len) nx -= n_len

            x0 = x1
            y0 = y1
          } while (cx < right)
        }

        if (next_i < end) {
          continue
        }
      }

    } // end switch
  } // end for

  range.end = ptr
  range.count = count
  return -1
}

// @ts-ignore
@inline
function readSampleLerp(p: i32, nx: f32, frac: f32): f32 {
  const s0 = f32.load(p + (i32(nx) << 2))
  const s1 = f32.load(p + (i32(nx + 1) << 2))
  return s0 + (s1 - s0) * frac
}
