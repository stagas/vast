import { Sketch } from './sketch-class'
import { VertRange } from './sketch-shared'

export function createSketch(
  range$: usize,
  shapes$: usize,
  a_opts$: usize,
  a_vert$: usize,
  a_color$: usize,
  a_lineWidth$: usize,
): Sketch {
  return new Sketch(
    range$,
    shapes$,
    a_opts$,
    a_vert$,
    a_color$,
    a_lineWidth$,
  )
}

export function createVertRange(): VertRange {
  return new VertRange()
}
