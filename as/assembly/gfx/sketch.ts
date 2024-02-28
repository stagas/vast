import { Sketch } from './sketch-class'

export function createSketch(
  shapes$: usize,
  // a_opts$: usize,
  a_vert$: usize,
  a_style$: usize,
  // a_lineWidth$: usize,
): Sketch {
  return new Sketch(
    shapes$,
    // a_opts$,
    a_vert$,
    a_style$,
    // a_color$,
    // a_lineWidth$,
  )
}
