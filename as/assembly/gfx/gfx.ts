import { Sketch } from './sketch'
import { Box, Line, Matrix, Note, Notes, Wave } from './sketch-shared'

export * from '../alloc'
export * from './draw'

export function createSketch(
  a_vert$: usize,
  a_style$: usize,
): Sketch {
  return new Sketch(
    a_vert$,
    a_style$,
  )
}

export function createBox(): usize {
  return changetype<usize>(new Box())
}

export function createLine(): usize {
  return changetype<usize>(new Line())
}

export function createWave(): usize {
  return changetype<usize>(new Wave())
}

export function createNotes(): usize {
  return changetype<usize>(new Notes())
}

export function createNote(): usize {
  return changetype<usize>(new Note())
}

export function createMatrix(): usize {
  return changetype<usize>(new Matrix())
}
