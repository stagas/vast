import { VertOpts, VertRange } from './sketch-shared'
import { Floats, rgbToInt } from './util'

let t: f32 = 0

export function sketch(
  range$: usize,
  a_opts$: usize,
  a_vert$: usize,
  a_color$: usize,
): void {
  const range = changetype<VertRange>(range$)
  const a_opts = changetype<Floats>(a_opts$)
  const a_vert = changetype<Floats>(a_vert$)
  const a_color = changetype<Floats>(a_color$)

  range.end = 1
  range.count = 1

  a_opts[0] = f32(VertOpts.Quad)
  a_vert[0] = 50 + (Mathf.sin(t++ * 0.1) * 50)
  a_vert[1] = 50
  a_vert[2] = 200 + (Mathf.sin(t * 0.15) * 50)
  a_vert[3] = 100

  a_color[0] = f32(rgbToInt(1, 0, .5))
  a_color[1] = 1.0
}

export function createVertRange(): usize {
  return changetype<usize>(new VertRange)
}
