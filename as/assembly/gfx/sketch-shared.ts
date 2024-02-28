// 4 float bytes per instance, so we fit into 1 page
// (which might be better? TODO: bench)
export const MAX_BYTES = 65536 * 32 // 1 page
export const MAX_GL_INSTANCES = MAX_BYTES >> 2
export const MAX_SHAPES = 65536 * 32

export enum VertOpts {
  Box /* */ = 0b001,
  Line /**/ = 0b010,
}

export enum ShapeOpts {
  // kind
  Box /*      */ = 0b0000_0000_0001,
  Line /*     */ = 0b0000_0000_0010,
  Wave /*     */ = 0b0000_0000_0100,
  // flags
  Collapse /* */ = 0b0001_0000_0000,
  Join /*     */ = 0b0010_0000_0000,
}

export const WAVE_MIPMAPS = 13

// Note: All shapes must have equal 32bit size.
// and this must match count of shapes 32bit elements.
export const SHAPE_LENGTH = 11

@unmanaged
export class Shape {
  opts: f32 = f32(ShapeOpts.Box)
}

@unmanaged
export class Box {
  opts: f32 = f32(ShapeOpts.Box)
  x: f32 = 0
  y: f32 = 0
  w: f32 = 0
  h: f32 = 0

  lw: f32 = 1 // unused

  ptr: f32 = 0 // unused
  len: f32 = 0 // unused
  offset: f32 = 0 // unused

  color: f32 = 255
  alpha: f32 = 1.0
}

@unmanaged
export class Line {
  opts: f32 = f32(ShapeOpts.Line)
  x0: f32 = 0
  y0: f32 = 0
  x1: f32 = 0
  y1: f32 = 0

  lw: f32 = 1

  ptr: f32 = 0 // unused
  len: f32 = 0 // unused
  offset: f32 = 0 // unused

  color: f32 = 255
  alpha: f32 = 1.0
}

@unmanaged
export class Wave {
  opts: f32 = f32(ShapeOpts.Wave)
  x: f32 = 0
  y: f32 = 0
  w: f32 = 0
  h: f32 = 0

  lw: f32 = 1

  ptr: f32 = 0
  len: f32 = 0
  offset: f32 = 0

  color: f32 = 255
  alpha: f32 = 1.0
}

@unmanaged
export class Matrix {
  constructor() { }
  a: f64 = 0
  b: f64 = 0
  c: f64 = 0
  d: f64 = 0
  e: f64 = 0
  f: f64 = 0
}
