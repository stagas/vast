import { Sketch } from './sketch-class'
import { VertRange } from './sketch-shared'

export function createSketch(
  range$: usize,
  shapes$: usize,
  a_opts$: usize,
  a_vert$: usize,
  a_color$: usize,
  a_lineWidth$: usize,
): usize {
  return changetype<usize>(new Sketch(
    range$,
    shapes$,
    a_opts$,
    a_vert$,
    a_color$,
    a_lineWidth$,
  ))
}

export function createVertRange(): usize {
  return changetype<usize>(new VertRange)
}
