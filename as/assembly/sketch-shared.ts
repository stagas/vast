import { Floats } from './util'

export const MAX_BYTES = 65536 * 16 // 16 pages
export const MAX_INSTANCES = MAX_BYTES >> 1 >> 3

export class Box {
  x: f32 = 0
  y: f32 = 0
  w: f32 = 0
  h: f32 = 0
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

export enum VertOpts {
  Quad = 0b0001
}

@unmanaged
export class VertRange {
  begin: i32 = 0
  end: i32 = 0
  count: i32 = 0
}

export class Sketch {
  range: VertRange
  a_opts: Floats
  a_vert: Floats
  a_color: Floats
  constructor(
    public range$: usize,
    public a_opts$: usize,
    public a_vert$: usize,
    public a_color$: usize,
  ) {
    this.range = changetype<VertRange>(range$)
    this.a_opts = changetype<Floats>(a_opts$)
    this.a_vert = changetype<Floats>(a_vert$)
    this.a_color = changetype<Floats>(a_color$)
  }
}
