import { VertOpts, VertRange } from './sketch-shared'
import { Floats } from '../util'

export class Sketch {
  range: VertRange
  shapes: Floats
  a_opts: Floats
  a_vert: Floats
  a_color: Floats
  a_lineWidth: Floats
  constructor(
    public range$: usize,
    public shapes$: usize,
    public a_opts$: usize,
    public a_vert$: usize,
    public a_color$: usize,
    public a_lineWidth$: usize,
  ) {
    this.range = changetype<VertRange>(range$)
    this.shapes = changetype<Floats>(shapes$)
    this.a_opts = changetype<Floats>(a_opts$)
    this.a_vert = changetype<Floats>(a_vert$)
    this.a_color = changetype<Floats>(a_color$)
    this.a_lineWidth = changetype<Floats>(a_lineWidth$)
  }
  @inline
  putBox(
    ptr: i32,
    x: f32, y: f32, w: f32, h: f32,
    color: f32,
    alpha: f32,
  ): void {
    const ptr4 = (ptr * 4) << 2
    const ptr2 = (ptr * 2) << 2
    unchecked(this.a_opts[ptr] = f32(VertOpts.Box))
    put4(this.a_vert$ + ptr4, x, y, w, h)
    put2(this.a_color$ + ptr2, color, alpha)
  }
  @inline
  putLine(
    ptr: i32,
    x0: f32, y0: f32,
    x1: f32, y1: f32,
    color: f32,
    alpha: f32,
    lineWidth: f32
  ): void {
    const ptr4 = (ptr * 4) << 2
    const ptr2 = (ptr * 2) << 2
    unchecked(this.a_opts[ptr] = f32(VertOpts.Line))
    put4(this.a_vert$ + ptr4, x0, y0, x1, y1)
    put2(this.a_color$ + ptr2, color, alpha)
    unchecked(this.a_lineWidth[ptr] = lineWidth)
  }
}

// @ts-ignore
@inline
function put4(ptr: usize, x: f32, y: f32, z: f32, w: f32): void {
  f32.store(ptr, x)
  f32.store(ptr, y, 4)
  f32.store(ptr, z, 8)
  f32.store(ptr, w, 12)
}

// @ts-ignore
@inline
function put2(ptr: usize, x: f32, y: f32): void {
  f32.store(ptr, x)
  f32.store(ptr, y, 4)
}
