import wasm from 'assembly'
import { GL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { defineStruct } from 'utils'
import { Box, SHAPE_LENGTH, Line, MAX_GL_INSTANCES, MAX_SHAPES, VertOpts, VertRange, Wave, ShapeKind } from '../../as/assembly/sketch-shared.ts'
import { MeshInfo } from '../mesh-info.ts'
import { WasmMatrix } from '../util/wasm-matrix.ts'

const DEBUG = false

// 4 float bytes per instance, so we fit into 1 page
// (which might be better? TODO: bench)

const hasVertOpts = (...bits: number[]) => /*glsl*/
  `(int(a_opts) & (${bits.join(' | ')})) != 0`

const vertex = /*glsl*/`
#version 300 es
precision highp float;

in float a_quad;
in float a_opts;
in vec4 a_vert;
in vec2 a_color;

uniform float u_pr;
uniform vec2 u_screen;

out vec2 v_color;

void main() {
  vec2 quad = vec2(
      mod(a_quad,  2.0),
    floor(a_quad / 2.0)
  );

  vec2 pos = (a_vert.xy + a_vert.zw * quad) * u_pr;
  pos /= u_screen * 0.5;
  pos -= 1.0;
  pos.y *= -1.0;

  if (${hasVertOpts(VertOpts.Box)}) {
    // pos.y += .1;
  }

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

  console.log('[sketch] MAX_GL_INSTANCES:', MAX_GL_INSTANCES)

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
    }
  })

  const range$ = wasm.createVertRange() // TODO: __pin and free structs
  const range = defineStruct({
    begin: 'i32',
    end: 'i32',
    count: 'i32',
  })(wasm.memory.buffer, range$) satisfies VertRange

  const {
    a_opts,
    a_vert,
    a_color,
  } = info.attribs

  const Box = defineStruct({
    kind: 'i32',
    x: 'f32',
    y: 'f32',
    w: 'f32',
    h: 'f32',
    lw: 'f32',
    ptr: 'f32',
    color: 'i32',
    alpha: 'f32',
  })

  const Line = defineStruct({
    kind: 'i32',
    ax: 'f32',
    ay: 'f32',
    bx: 'f32',
    by: 'f32',
    lw: 'f32',
    ptr: 'f32',
    color: 'i32',
    alpha: 'f32',
  })

  const Wave = defineStruct({
    kind: 'i32',
    x: 'f32',
    y: 'f32',
    w: 'f32',
    h: 'f32',
    lw: 'f32',
    ptr: 'f32',
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

  const sketch$ = wasm.createSketch(
    range.ptr,
    shapes.ptr,
    a_opts.ptr,
    a_vert.ptr,
    a_color.ptr,
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
    DEBUG && console.log('[sketch] write gl begin:', range.begin, 'end:', range.end, 'count:', range.count)
  }

  function write(data: Float32Array) {
    const count = data.length / SHAPE_LENGTH
    const begin = shapes.count
    const end = (shapes.count += count)
    shapes.set(data, begin)
    // info.attribs.a_opts.data.fill(opts, begin, end)
    DEBUG && console.log('[sketch] write instances begin:', begin, 'end:', end, 'count:', count)
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

    while (index = sketchDraw(
      mat2d,
      view,
      index,
      shapes.count
    )) {
      DEBUG && console.log('[sketch] draw', index, index >= 0 ? shapes.count - index : '---')

      writeGL()

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, range.count)

      if (index === -1) break

      range.begin =
        range.end =
        range.count = 0
    }
  }

  return { draw, shape, info, write }
}
