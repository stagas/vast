import { Floats } from './util'

export const MAX_BYTES = 65536 // 1 page
export const MAX_GL_INSTANCES = MAX_BYTES >> 1 >> 3
export const MAX_SHAPES = 16384

export enum VertOpts {
  Box /* */ = 0b001,
  Line /**/ = 0b010,
}

export enum ShapeKind {
  Box = 1,
  Line,
  Wave,
}

// Note: All shapes must have equal 32bit size.
// and this must match count of shapes 32bit elements.
export const SHAPE_LENGTH = 9

export class Box {
  kind: i32 = ShapeKind.Box
  x: f32 = 0
  y: f32 = 0
  w: f32 = 0
  h: f32 = 0
  lw: f32 = 1 // unused
  ptr: f32 = 0 // unused
  color: f32 = 255
  alpha: f32 = 1.0
}

export class Line {
  kind: i32 = ShapeKind.Line
  ax: f32 = 0
  ay: f32 = 0
  bx: f32 = 0
  by: f32 = 0
  lw: f32 = 1
  ptr: f32 = 0 // unused
  color: f32 = 255
  alpha: f32 = 1.0
}

export class Wave {
  kind: i32 = ShapeKind.Wave
  x: f32 = 0
  y: f32 = 0
  w: f32 = 0
  h: f32 = 0
  lw: f32 = 1
  ptr: f32 = 0
  color: f32 = 255
  alpha: f32 = 1.0
}

@unmanaged
export class Matrix {
  a: f32 = 0
  b: f32 = 0
  c: f32 = 0
  d: f32 = 0
  e: f32 = 0
  f: f32 = 0
}

@unmanaged
export class VertRange {
  begin: i32 = 0
  end: i32 = 0
  count: i32 = 0
}

export class Sketch {
  range: VertRange
  shapes: Floats
  a_opts: Floats
  a_vert: Floats
  a_color: Floats
  constructor(
    public range$: usize,
    public shapes$: usize,
    public a_opts$: usize,
    public a_vert$: usize,
    public a_color$: usize,
  ) {
    this.range = changetype<VertRange>(range$)
    this.shapes = changetype<Floats>(shapes$)
    this.a_opts = changetype<Floats>(a_opts$)
    this.a_vert = changetype<Floats>(a_vert$)
    this.a_color = changetype<Floats>(a_color$)
  }
}
