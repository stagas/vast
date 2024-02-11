import wasm from 'assembly'
import { GL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { MeshInfo } from '../mesh-info.ts'
import { VertOpts, VertRange } from '../../as/assembly/sketch-shared.ts'
import { defineStruct } from 'utils'

// 4 float bytes per instance, so we fit into 1 page
// (which might be better? TODO: bench)
const MAX_BYTES = 65536
const MAX_INSTANCES = MAX_BYTES >> 1 >> 3

const hasVertOpts = (...bits: number[]) => /*glsl*/
  `(int(a_opts) & (${bits.join(' | ')})) != 0`

const vertex = /*glsl*/`
#version 300 es
precision highp float;

in float a_quad;
in float a_opts;
in vec4 a_vert;
in vec2 a_color;

uniform vec2 u_screen;

out vec2 v_color;

void main() {
  vec2 quad = vec2(
      mod(a_quad,  2.0),
    floor(a_quad / 2.0)
  );

  vec2 pos = a_vert.xy + a_vert.zw * quad;
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

  function write() {
    GL.writeAttribRange(a_opts, range)
    GL.writeAttribRange(a_vert, range)
    GL.writeAttribRange(a_color, range)
  }

  $.fx(() => () => {
    sketch = null
  })

  $.fx(() => {
    const { w, h } = view
    $()
    info.use()
    gl.uniform2f(info.uniforms.u_screen, w, h)
  })

  return { info, range, write }
}

let sketch: ReturnType<typeof SketchInfo> | null

export type Sketch = ReturnType<typeof Sketch>

export function Sketch(GL: GL, view: Rect) {
  using $ = Signal()

  sketch ??= SketchInfo(GL, view)

  const { gl } = GL
  const { info, range, write } = sketch
  const { use } = info

  const {
    a_opts,
    a_vert,
    a_color,
  } = info.attribs

  function draw() {
    use()

    wasm.sketch(
      range.ptr,
      a_opts.ptr,
      a_vert.ptr,
      a_color.ptr,
    )

    write()

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, range.count)
  }

  return { draw }
}
