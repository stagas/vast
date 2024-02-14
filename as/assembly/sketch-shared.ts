import { Floats } from './util'

// 4 float bytes per instance, so we fit into 1 page
// (which might be better? TODO: bench)
export const MAX_BYTES = 65536 * 32 // 1 page
export const MAX_GL_INSTANCES = MAX_BYTES >> 1 >> 3
export const MAX_SHAPES = 65536 * 32

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
export const SHAPE_LENGTH = 10

@unmanaged
export class Shape {
  kind: f32 = f32(ShapeKind.Box)
}

@unmanaged
export class Box {
  kind: f32 = f32(ShapeKind.Box)
  x: f32 = 0
  y: f32 = 0
  w: f32 = 0
  h: f32 = 0

  lw: f32 = 1 // unused

  ptr: f32 = 0 // unused
  len: f32 = 0 // unused

  color: f32 = 255
  alpha: f32 = 1.0
}

@unmanaged
export class Line {
  kind: f32 = f32(ShapeKind.Line)
  x0: f32 = 0
  y0: f32 = 0
  x1: f32 = 0
  y1: f32 = 0

  lw: f32 = 1

  ptr: f32 = 0 // unused
  len: f32 = 0 // unused

  color: f32 = 255
  alpha: f32 = 1.0
}

export class Wave {
  kind: f32 = f32(ShapeKind.Wave)
  x: f32 = 0
  y: f32 = 0
  w: f32 = 0
  h: f32 = 0

  lw: f32 = 1

  ptr: f32 = 0
  len: f32 = 0

  color: f32 = 255
  alpha: f32 = 1.0
}

@unmanaged
export class Matrix {
  a: f64 = 0
  b: f64 = 0
  c: f64 = 0
  d: f64 = 0
  e: f64 = 0
  f: f64 = 0
}

@unmanaged
export class VertRange {
  begin: i32 = 0
  end: i32 = 0
  count: i32 = 0
}
