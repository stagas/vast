import { logf, logf2, logf3, logf4, logf6, logi } from '../env'
import { Sketch } from './sketch-class'
import { Box, SHAPE_LENGTH, Matrix, Wave, ShapeOpts, Shape, Line } from './sketch-shared'

const MAX_ZOOM: f32 = 0.5
const BASE_SAMPLES: f32 = 48000
const NUM_SAMPLES: f32 = BASE_SAMPLES / MAX_ZOOM

// const Divisors =       [2,    4,    8,   16,  32,  64, 128, 256]

const thresholds: f32[] = [4000, 2000, 800, 300, 150, 75, 30, 10]

const enum WaveMode {
  Scaled,
  Normal,
  Far,
  VeryFar,
}

export function draw(
  sketch$: usize,

  matrix$: usize,
  width: f32,
  height: f32,

  begin: i32,
  end: i32,
): void {
  const sketch = changetype<Sketch>(sketch$)
  const shapes$ = sketch.shapes$

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

  let px: f32 = 0
  let py: f32 = 0

  for (let i = begin; i < end; i++) {
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

        sketch.drawBox(
          x, y, w, h,
          box.color, box.alpha
        )

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

        sketch.drawLine(
          x0, y0,
          x1, y1,
          line.color, line.alpha,
          line.lw,
        )

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

        //
        // sample coeff for zoom level
        //
        let sample_coeff: f64 = f64(NUM_SAMPLES / ma)

        //
        // setup wave pointers
        //
        let p = i32(wave.ptr)
        let p_index: i32 = 0
        let n: f64 = 0
        let n_len = f64(wave.len)

        //
        // determine right edge
        //
        let right = x + w

        //
        // determine left edge (cx)
        //
        let cx: f64 = f64(x)
        let ox: f32 = 0
        // if left edge is offscreen
        if (cx < 0) {
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
          cw = f32(width - cx)
          right = width
        }
        // or if left edge is offscreen
        else if (x < 0) {
          cw -= ox
        }

        let x_step: f64 = f64(ma / NUM_SAMPLES)
        let n_step: f64 = 1.0
        let mul: f64 = 1.0
        let lw: f32 = 1.1

        let waveMode: WaveMode = WaveMode.Scaled

        for (let i = 0; i < thresholds.length; i++) {
          const threshold = thresholds[i]
          if (ma < threshold) {
            waveMode = WaveMode.Normal
            p_index += i32(Math.floor(n_len))
            n_len = Math.floor(n_len / 2.0)
            mul *= 2.0
            x_step *= 2.0
            lw = 1.1 - (0.8 * (1 -
              (f32(ma / 4000) ** .35)
            ))
          }
          else {
            break
          }
        }

        n_step = sample_coeff / (mul / x_step)

        p += p_index << 2

        const hh: f32 = h / 2
        const yh = y + hh

        switch (waveMode) {
          case WaveMode.Scaled: {
            // advance the pointer if left edge is offscreen
            if (ox) {
              n += Math.floor(ox / x_step)
            }
            n = Math.floor(n)

            // interpolate 2 samples
            let nx = (n * n_step) % n_len
            let nfrac = nx - Math.floor(nx)

            // move to v0
            let x0 = f32(cx)
            let y0 = yh + readSampleLerp(p, f32(nx), nfrac) * hh

            if (opts & ShapeOpts.Join) {
              sketch.drawLine(
                px, py,
                x0, y0,
                wave.color, wave.alpha,
                lw
              )
            }

            do {
              cx += x_step
              nx += n_step
              if (nx >= n_len) nx -= n_len

              nfrac = nx - Math.floor(nx)

              const x1 = f32(cx)
              const y1 = yh + readSampleLerp(p, f32(nx), nfrac) * hh

              sketch.drawLine(
                x0, y0,
                x1, y1,
                wave.color, wave.alpha,
                lw
              )

              x0 = x1
              y0 = y1
            } while (cx < right)

            px = x0
            py = y0

            break
          }

          case WaveMode.Normal: {
            // advance the pointer if left edge is offscreen
            if (ox) {
              n += Math.floor(ox / x_step)
            }
            n = Math.floor(n)

            let nx = (n * n_step) % n_len
            let s = f32.load(p + (i32(nx) << 2))

            // move to v0
            let x0 = f32(cx)
            let y0 = yh + s * hh

            if (opts & ShapeOpts.Join) {
              sketch.drawLine(
                px, py,
                x0, y0,
                wave.color, wave.alpha,
                lw
              )
            }

            do {
              cx += x_step
              nx += n_step
              if (nx >= n_len) nx -= n_len

              const x1 = f32(cx)
              const y1 = yh + f32.load(p + (i32(nx) << 2)) * hh

              sketch.drawLine(
                x0, y0,
                x1, y1,
                wave.color, wave.alpha,
                lw
              )

              x0 = x1
              y0 = y1
            } while (cx < right)

            px = x0
            py = y0

            break
          }

          // case WaveMode.Far: {
          //   // advance the pointer if left edge is offscreen
          //   if (ox) {
          //     n += Mathf.floor(ox / x_step)
          //   }
          //   n = Mathf.floor(n)

          //   let nx = (n * n_step) % n_len

          //   let min: f32
          //   let max: f32

          //   let pos: i32

          //   pos = i32(Mathf.floor(f32(p + (i32(nx) << 2)) / 2.0) * 2.0)

          //   min = f32.load(p + (i32(nx) << 2))

          //   // move to v0
          //   let x0 = cx
          //   let y0 = y + hh + min * hh // TODO: hh in shader?

          //   if (opts & ShapeOpts.Join) {
          //     sketch.drawLine(
          //       px, py,
          //       x0, y0,
          //       wave.color, wave.alpha,
          //       lw
          //     )
          //   }

          //   let step_i: i32 = 0
          //   let bcx = cx
          //   let bnx = nx

          //   do {
          //     cx = f32(f64(bcx) + f64(step_i) * f64(x_step))
          //     // the rounding here fixes flickering
          //     nx = Mathf.round(f32((f64(bnx) + f64(step_i) * f64(n_step))) % n_len)

          //     pos = i32(Mathf.floor(f32(p + (i32(nx) << 2)) / 2.0) * 2.0)
          //     min = f32.load(pos)
          //     max = f32.load(pos, 4)

          //     const x1 = cx
          //     const y1 = y + hh + min * hh

          //     sketch.drawLine(
          //       x0, y0,
          //       x1, y1,
          //       wave.color, wave.alpha,
          //       lw
          //     )

          //     const x2 = cx
          //     const y2 = y + hh + max * hh

          //     sketch.drawLine(
          //       x1, y1,
          //       x2, y2,
          //       wave.color, wave.alpha,
          //       lw
          //     )

          //     x0 = x2
          //     y0 = y2

          //     step_i++
          //   } while (cx < right)

          //   px = x0
          //   py = y0

          //   break
          // }
        }

        continue
      }

    } // end switch
  } // end for

  if (sketch.ptr) {
    sketch.flush()
  }
}

// @ts-ignore
@inline
function readSampleLerp(p: i32, nx: f32, frac: f64): f32 {
  const s0 = f32.load(p + (i32(nx) << 2))
  const s1 = f32.load(p + (i32(nx + 1) << 2))
  return f32(f64(s0) + f64(s1 - s0) * frac)
}
