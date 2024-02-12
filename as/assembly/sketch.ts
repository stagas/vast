import { Sketch, VertRange } from './sketch-shared'

export function createSketch(
  range$: usize,
  a_opts$: usize,
  a_vert$: usize,
  a_color$: usize,
): usize {
  return changetype<usize>(new Sketch(
    range$,
    a_opts$,
    a_vert$,
    a_color$,
  ))
}

export function createVertRange(): usize {
  return changetype<usize>(new VertRange)
}
