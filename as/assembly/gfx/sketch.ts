import { Sketch } from './sketch-class'

export function createSketch(
  a_vert$: usize,
  a_style$: usize,
): Sketch {
  return new Sketch(
    a_vert$,
    a_style$,
  )
}
