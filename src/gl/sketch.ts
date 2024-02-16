import wasm from 'assembly'
import { GL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { Struct } from 'utils'
import { Box, SHAPE_LENGTH, Line, MAX_GL_INSTANCES, MAX_SHAPES, VertOpts, VertRange, Wave, ShapeKind } from '../../as/assembly/sketch-shared.ts'
import { MeshInfo } from '../mesh-info.ts'
import { WasmMatrix } from '../util/wasm-matrix.ts'

const DEBUG = false

export namespace ShapeData {
  export type Box = [
    kind: ShapeKind.Box,
    x: number,
    y: number,
    w: number,
    h: number,
    lw: number,
    ptr: number,
    len: number,
    color: number,
    alpha: number,
  ]

  export type Wave = [
    kind: ShapeKind.Wave,
    x: number,
    y: number,
    w: number,
    h: number,
    lw: number,
    ptr: number,
    len: number,
    color: number,
    alpha: number,
  ]

  export type Line = [
    kind: ShapeKind.Line,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    lw: number,
    ptr: number,
    len: number,
    color: number,
    alpha: number,
  ]
}

const hasVertOpts = (...bits: number[]) => /*glsl*/
  `(int(a_opts) & (${bits.join(' | ')})) != 0`

const vertex = /*glsl*/`
#version 300 es
precision highp float;

in float a_quad;
in float a_opts;
in vec4 a_vert;
in vec2 a_color;
in float a_lineWidth;

uniform float u_pr;
uniform vec2 u_screen;

out vec2 v_color;

vec2 perp(vec2 v) {
  return vec2(-v.y, v.x);
}

void main() {
  vec2 pos = vec2(0.,0.);

  vec2 quad = vec2(
      mod(a_quad,  2.0),
    floor(a_quad / 2.0)
  );

  if (${hasVertOpts(VertOpts.Line)}) {
    vec2 a = a_vert.xy;
    vec2 b = a_vert.zw;
    vec2 v = b - a;

    float mag = length(v);
    float mag1 = 1.0 / mag;
    vec2 n = perp(v) * mag1;

    float lw = a_lineWidth;
    float lwh = lw * 0.5;

    mat3 transform = mat3(
      v.x,             v.y,             0.0,
      n.x * lw,        n.y * lw,        0.0,
      a.x - n.x * lwh, a.y - n.y * lwh, 1.0
    );

    pos = (transform * vec3(quad, 1.0)).xy * 2.0;
  }
  else {
    pos = (a_vert.xy + a_vert.zw * quad) * u_pr;
  }

  pos /= u_screen * 0.5;
  pos -= 1.0;
  pos.y *= -1.0;
  gl_Position = vec4(pos, 0.0, 1.0);

  v_color = a_color;
}
`

const fragment = /*glsl*/`
#version 300 es

precision highp float;

in vec2 v_color;
out vec4 fragColor;

vec3 intToRgb(int color) {
  int r = (color >> 16) & 0xFF;
  int g = (color >> 8) & 0xFF;
  int b = color & 0xFF;
  return vec3(float(r), float(g), float(b)) / 255.0;
}

void main() {
  fragColor = vec4(intToRgb(int(v_color.x)), v_color.y);
}
`

function SketchInfo(GL: GL, view: Rect) {
  using $ = Signal()

  const { gl, attrib } = GL

  DEBUG && console.log('[sketch] MAX_GL_INSTANCES:', MAX_GL_INSTANCES)

  const info = MeshInfo(GL, {
    vertex,
    fragment,
    vao: {
      a_quad: [
        gl.ARRAY_BUFFER, attrib(1, new Float32Array([0, 1, 2, 3]))
      ],
      a_opts: [
        gl.ARRAY_BUFFER, attrib(1, wasm.alloc(Float32Array, MAX_GL_INSTANCES), 1),
        gl.DYNAMIC_DRAW
      ],
      a_vert: [
        gl.ARRAY_BUFFER, attrib(4, wasm.alloc(Float32Array, MAX_GL_INSTANCES * 4), 1),
        gl.DYNAMIC_DRAW
      ],
      a_color: [
        gl.ARRAY_BUFFER, attrib(2, wasm.alloc(Float32Array, MAX_GL_INSTANCES * 2), 1),
        gl.DYNAMIC_DRAW
      ],
      a_lineWidth: [
        gl.ARRAY_BUFFER, attrib(1, wasm.alloc(Float32Array, MAX_GL_INSTANCES), 1),
        gl.DYNAMIC_DRAW
      ],
    }
  })

  const Box = Struct({
    kind: 'i32',
    x: 'f32',
    y: 'f32',
    w: 'f32',
    h: 'f32',
    lw: 'f32',
    ptr: 'f32',
    len: 'f32',
    color: 'i32',
    alpha: 'f32',
  })

  const Line = Struct({
    kind: 'i32',
    x0: 'f32',
    y0: 'f32',
    x1: 'f32',
    y1: 'f32',
    lw: 'f32',
    ptr: 'f32',
    len: 'f32',
    color: 'i32',
    alpha: 'f32',
  })

  const Wave = Struct({
    kind: 'i32',
    x: 'f32',
    y: 'f32',
    w: 'f32',
    h: 'f32',
    lw: 'f32',
    ptr: 'f32',
    len: 'f32',
    color: 'i32',
    alpha: 'f32',
  })

  const shapesLength = MAX_SHAPES * (Box.byteLength >> 2)

  DEBUG && console.log('[sketch]', 'MAX_SHAPES:', MAX_SHAPES, 'bytes:', shapesLength)

  const shapes = Object.assign(
    wasm.alloc(Float32Array, shapesLength),
    { count: 0 }
  )

  const box = Box(wasm.memory.buffer, shapes.ptr) satisfies Box
  const line = Line(wasm.memory.buffer, shapes.ptr) satisfies Line
  const wave = Wave(wasm.memory.buffer, shapes.ptr) satisfies Wave

  const range$ = wasm.createVertRange() // TODO: __pin and free structs
  const range = Struct({
    begin: 'i32',
    end: 'i32',
    count: 'i32',
  })(wasm.memory.buffer, range$) satisfies VertRange

  const {
    a_opts,
    a_vert,
    a_color,
    a_lineWidth,
  } = info.attribs

  const sketch$ = wasm.createSketch(
    range.ptr,
    shapes.ptr,
    a_opts.ptr,
    a_vert.ptr,
    a_color.ptr,
    a_lineWidth.ptr,
  )

  function draw(
    mat2d: WasmMatrix,
    view: { width: number, height: number },
    begin: number,
    end: number
  ) {
    return wasm.draw(
      sketch$,
      mat2d.ptr,
      view.width,
      view.height,
      begin,
      end,
    )
  }

  function writeGL() {
    GL.writeAttribRange(a_opts, range)
    GL.writeAttribRange(a_vert, range)
    GL.writeAttribRange(a_color, range)
    GL.writeAttribRange(a_lineWidth, range)
    DEBUG && console.log('[sketch] write gl begin:', range.begin, 'end:', range.end, 'count:', range.count)
  }

  function write(data: Float32Array) {
    const count = data.length / SHAPE_LENGTH
    const begin = shapes.count
    const end = (shapes.count += count)
    DEBUG && console.log('[sketch] shapes write begin:', begin, 'end:', end, 'count:', count)
    shapes.set(data, begin * SHAPE_LENGTH)
  }

  $.fx(() => {
    const { pr, w_pr, h_pr } = view
    $()
    info.use()
    gl.uniform1f(info.uniforms.u_pr, pr)
    gl.uniform2f(info.uniforms.u_screen, w_pr, h_pr)
  })

  $.fx(() => () => {
    sketch = null
  })

  return {
    info, range, write, writeGL,
    shapes,
    shape: {
      box,
      line,
      wave,
    },
    draw
  }
}

let sketch: ReturnType<typeof SketchInfo> | null

export type Sketch = ReturnType<typeof Sketch>

export function Sketch(GL: GL, view: Rect, mat2d: WasmMatrix) {
  using $ = Signal()

  sketch ??= SketchInfo(GL, view)

  const { gl } = GL
  const { info, range, write, writeGL, shapes, shape, draw: sketchDraw } = sketch
  const { use } = info

  function draw() {
    use()

    range.begin =
      range.end =
      range.count = 0

    let index = 0
    let lastIndex = -2
    let previousLastIndex = -3
    while (index = sketchDraw(
      mat2d,
      view,
      index,
      shapes.count
    )) {
      if (previousLastIndex === index) {
        // we're in an infinite loop, so stop drawing
        break
      }

      DEBUG && console.log('[sketch] draw', index, index >= 0 ? shapes.count - index : '---')

      writeGL()

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, range.count)

      if (index === -1) break

      previousLastIndex = lastIndex
      lastIndex = index

      range.begin =
        range.end =
        range.count = 0
    }
  }

  return { draw, shapes, shape, info, write }
}
