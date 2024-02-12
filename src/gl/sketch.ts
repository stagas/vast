import wasm from 'assembly'
import { GL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { defineStruct } from 'utils'
import { Box, MAX_BOXES, MAX_INSTANCES, VertOpts, VertRange } from '../../as/assembly/sketch-shared.ts'
import { MeshInfo } from '../mesh-info.ts'

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

  if (${hasVertOpts(VertOpts.Quad)}) {
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

  console.log('[sketch] MAX_INSTANCES:', MAX_INSTANCES)

  const info = MeshInfo(GL, {
    vertex,
    fragment,
    vao: {
      a_quad: [
        gl.ARRAY_BUFFER, attrib(1, new Float32Array([0, 1, 2, 3]))
      ],
      a_opts: [
        gl.ARRAY_BUFFER, attrib(1, wasm.alloc(Float32Array, MAX_INSTANCES), 1),
        gl.DYNAMIC_DRAW
      ],
      a_vert: [
        gl.ARRAY_BUFFER, attrib(4, wasm.alloc(Float32Array, MAX_INSTANCES * 4), 1),
        gl.DYNAMIC_DRAW
      ],
      a_color: [
        gl.ARRAY_BUFFER, attrib(2, wasm.alloc(Float32Array, MAX_INSTANCES * 2), 1),
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

  const sketch$ = wasm.createSketch(
    range.ptr,
    a_opts.ptr,
    a_vert.ptr,
    a_color.ptr,
  )

  const Box = defineStruct({
    x: 'f32',
    y: 'f32',
    w: 'f32',
    h: 'f32',
    lw: 'f32',
    color: 'i32',
    alpha: 'f32',
  })
  const boxesLength = MAX_BOXES * (Box.byteLength >> 2)
  DEBUG && console.log('[sketch]', 'MAX_BOXES:', MAX_BOXES, 'bytes:', boxesLength)
  const boxes = Object.assign(
    wasm.alloc(Float32Array, boxesLength),
    { count: 0 }
  )
  const box = Box(wasm.memory.buffer, boxes.byteOffset) satisfies Box

  function drawBoxes(
    mat2d: Float32Array,
    view: { width: number, height: number },
    begin: number,
    end: number
  ) {
    return wasm.drawBoxes(
      sketch$,
      mat2d.byteOffset,
      boxes.byteOffset,
      view.width,
      view.height,
      begin,
      end,
    )
  }

  function write() {
    GL.writeAttribRange(a_opts, range)
    GL.writeAttribRange(a_vert, range)
    GL.writeAttribRange(a_color, range)
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
    info, range, write,
    boxes, box, drawBoxes
  }
}

let sketch: ReturnType<typeof SketchInfo> | null

export type Sketch = ReturnType<typeof Sketch>

export function Sketch(GL: GL, view: Rect, mat2d: Float32Array) {
  using $ = Signal()

  sketch ??= SketchInfo(GL, view)

  const { gl } = GL
  const { info, range, write, boxes, box, drawBoxes } = sketch
  const { use } = info

  function draw() {
    use()

    range.begin =
      range.end =
      range.count = 0

    let index = 0

    while (index = drawBoxes(
      mat2d,
      view,
      index,
      boxes.count
    )) {
      DEBUG && console.log('[sketch] drawBoxes', index, index >= 0 ? boxes.count - index : '---')

      write()

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, range.count)

      if (index === -1) break

      range.begin =
        range.end =
        range.count = 0
    }
  }

  return { draw, boxes, box }
}
