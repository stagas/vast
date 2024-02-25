import { logf, logf2, logf3, logf4, logf6, logi } from '../env'
import { Sketch } from './sketch-class'
import { Box, SHAPE_LENGTH, Matrix, Wave, ShapeOpts, Shape, Line } from './sketch-shared'

const MAX_ZOOM: f32 = 0.5
const BASE_SAMPLES: f32 = 48000
const NUM_SAMPLES: f32 = BASE_SAMPLES / MAX_ZOOM

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
        const sample_coeff: f32 = f32(NUM_SAMPLES / ma)

        //
        // setup wave pointers
        //
        let p = i32(wave.ptr)
        let p_index: i32 = 0
        let n: f32 = 0
        let n_len = wave.len

        //
        // determine right edge
        //
        let right = x + w

        //
        // determine left edge (cx)
        //
        let cx: f32 = x
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
          cw = width - cx
          right = width
        }
        // or if left edge is offscreen
        else if (x < 0) {
          cw -= ox
        }

        let x_step: f32 = f32(ma / NUM_SAMPLES) * 8.0
        let mul: f32 = 1.0
        let lw: f32 = 1.5

        // logf(f32(ma))

        let waveMode: WaveMode = WaveMode.Scaled

        // if (ma < 5000) {
        if (ma < 1500) {
          if (ma < 500) {
            if (ma < 150) {
              if (ma < 70) {
                p_index += i32(wave.len)
                n_len = Mathf.floor(wave.len / 16.0)
                mul = 4.0
                if (ma < 20) {
                  if (ma < 10) {
                    // if (ma < 5) {
                    //   p_index += i32(n_len)
                    //   n_len = Mathf.floor(n_len / 4.0)
                    //   mul = 16

                    //   if (ma < 1) {
                    //     p_index += i32(n_len)
                    //     x_step = 1
                    //     n_len = 2
                    //     waveMode = WaveMode.VeryFar
                    //   }
                    //   else {
                    //     waveMode = WaveMode.Normal
                    //     x_step = 0.00125
                    //   }
                    // }
                    // else {
                    waveMode = WaveMode.Normal
                    x_step = 0.125
                    // }
                  }
                  else {
                    waveMode = WaveMode.Normal
                    x_step = 0.125
                  }
                }
                else {
                  waveMode = WaveMode.Normal
                  x_step = 0.5
                }
              }
              else {
                waveMode = WaveMode.Normal
                // x_step = 0.0125
                x_step = 0.5
              }
            }
            else {
              waveMode = WaveMode.Normal
              x_step = 0.5
            }
          }
          else {
            waveMode = WaveMode.Normal
            x_step = 0.5
          }
        }
        //   else {
        //     waveMode = WaveMode.Normal
        //     x_step = 0.5
        //   }
        // }

        p += p_index << 2

        // x_step *= 0.05

        //
        // determine sampling coeff based on
        // the horizontal zoom level (m.a).
        //
        let coeff: f32 = sample_coeff / (mul / x_step)

        // logf2(f32(ma), coeff)
        // logf3(x_step, coeff, f32(ma))
        // logf2(x_step, coeff)


        // if (ma < 10) {
        //   p_index += i32(wave.len)
        //   n_len = Mathf.floor(wave.len / 16.0)

        //   if (ma < 2) {
        //     p_index += i32(n_len * 2.0)
        //     n_len = Mathf.floor(((wave.len / 16.0) * 2.0) / 4.0)

        //     if (ma < 1) {
        //       p_index += i32(n_len)
        //       // logf(111)
        //       x_step = 1
        //       coeff = 1
        //       n_len = 2
        //     }
        //     else {
        //       // logf(222)
        //       x_step **= 1.5
        //       // x_step = .01
        //       x_step = Mathf.max(0.0085, x_step)
        //       coeff = sample_coeff / (8.0 / x_step)
        //       // logf2(x_step, coeff)
        //     }
        //   }
        //   else {
        //     // logf(333)
        //     x_step **= 1.5
        //     x_step = Mathf.max(0.03, x_step)
        //     // x_step = .1
        //     coeff = sample_coeff / (4.0 / x_step)
        //     // n_len = wave.len
        //   }

        //   p += p_index << 2
        // }

        // logf(f32(p))
        // logf(f32(ma))
        // logf2(n_coeff, n_step)

        // logf(f32(ma))
        // if (cw <= 1.0) {
        //   x_step = .15
        // }

        // let steps = i32(cw / x_step)
        // if (steps > i32(width) && ma > 200) {
        //   // logf2(666, f32(ma))
        //   coeff *= 1.0 / x_step
        //   x_step = 1.0
        //   steps = i32(cw)
        // }

        const hh: f32 = h / 2

        // advance the pointer if left edge is offscreen
        if (ox) {
          n += ox / x_step
        }

        // coeff *= 0.125
        let n_step = coeff

        switch (waveMode) {
          case WaveMode.Scaled: {
            // interpolate 2 samples
            let nx = (n * coeff) % n_len
            let nfrac = nx - Mathf.floor(nx)
            let s = readSampleLerp(p, nx, nfrac)

            // move to v0
            let x0 = cx
            let y0 = y + hh + s * hh // TODO: hh in shader?

            if (opts & ShapeOpts.Join) {
              sketch.drawLine(
                px, py,
                x0, y0,
                wave.color, wave.alpha,
                lw
              )
            }

            let step_i: i32 = 0
            let bcx = cx
            let bnx = nx

            do {
              step_i++

              cx = f32(f64(bcx) + f64(step_i) * f64(x_step))
              nx = f32((f64(bnx) + f64(step_i) * f64(n_step)) % n_len)

              nfrac = nx - Mathf.floor(nx)
              s = readSampleLerp(p, nx, nfrac)

              const x1 = cx
              const y1 = y + hh + s * hh

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
            // read first sample
            let nx = (n * coeff) % n_len
            let s = f32.load(p + (i32(nx) << 2))

            // move to v0
            let x0 = cx
            let y0 = y + hh + s * hh // TODO: hh in shader?

            // draw for every pixel step
            // right -= 1

            // const lw: f32 = 1.5 + f32(30.0 / ma)
            // logf2(lw, x_step)
            // x_step *= 0.125
            // n_step *= 0.125

            if (opts & ShapeOpts.Join) {
              sketch.drawLine(
                px, py,
                x0, y0,
                wave.color, wave.alpha,
                lw
              )
            }

            let step_i: i32 = 0
            let bcx = cx
            let bnx = nx

            do {
              step_i++

              cx = f32(f64(bcx) + f64(step_i) * f64(x_step))
              nx = f32((f64(bnx) + f64(step_i) * f64(n_step)) % n_len)

              s = f32.load(p + (i32(nx) << 2))

              const x1 = cx
              const y1 = y + hh + s * hh

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

          // case WaveMode.VeryFar: {
          //   let nx: f32 = 0 //(n * coeff) % n_len
          //   let s = f32.load(p + (i32(nx) << 2))

          //   // move to v0
          //   // let x0 = cx
          //   let y0 = y + hh + s * hh // TODO: hh in shader?

          //   if (opts & ShapeOpts.Join) {
          //     sketch.drawLine(
          //       px, py,
          //       cx, y0,
          //       wave.color, wave.alpha,
          //       1.5
          //     )
          //   }

          //   // cx += x_step
          //   nx += 1.0 //n_step

          //   s = f32.load(p + (i32(nx) << 2))

          //   // logf(s)
          //   // let x1 = cx //+ x_step
          //   const y1 = y + hh + s * hh

          //   do {
          //     sketch.drawLine(
          //       cx, y0,
          //       cx, y1,
          //       wave.color, wave.alpha,
          //       1.0
          //     )

          //     cx += 1.0
          //   } while (cx < right)

          //   px = cx
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
function readSampleLerp(p: i32, nx: f32, frac: f32): f32 {
  const s0 = f32.load(p + (i32(nx) << 2))
  const s1 = f32.load(p + (i32(nx + 1) << 2))
  return s0 + (s1 - s0) * frac
}
