import { GL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { MeshInfo } from '../mesh-info.ts'
import { World } from '../world/world.ts'
// import { log } from '../state.ts'

const vertex = /*glsl*/`
#version 300 es

precision highp float;

in vec4 a_vert_pos;
in vec4 a_box_pos;

uniform mat3 u_matrix;
uniform vec2 u_screen;
uniform float u_pr;
uniform float u_gap_x;
uniform float u_gap_y;

out float v_right;
out float v_bottom;
out float v_row_index;

void main() {
  vec2 top_left = vec2(-1.0, 1.0);

  vec2 half_screen = (inverse(u_matrix) * vec3(u_screen / u_pr, 1.0)).xy;
  vec2 box_size = a_box_pos.zw;
  vec2 pos = (
    a_vert_pos.xy
    * box_size
    + a_box_pos.xy
    * 2.0
    + box_size
  ) - half_screen;

  pos = (u_matrix * u_pr * vec3(pos, 1.0)).xy;
  pos = pos / u_screen;
  pos.y = -pos.y;

  v_right = (u_matrix * u_pr * vec3(a_box_pos.x + box_size.x, 1.0, 1.0)).x
    - u_gap_x;

  float scale_y = u_matrix[1][1];

  v_bottom = ( (a_vert_pos.y - 1.0) * -u_screen.y * u_pr) * scale_y
    - u_gap_y * u_screen.y * u_pr;

  v_row_index = a_box_pos.y;

  gl_Position = vec4(pos, 0.5, 1.0);
}
`

const fragment = /*glsl*/`
#version 300 es

precision highp float;

in float v_right;
in float v_bottom;
in float v_row_index;

uniform vec2 u_screen;
uniform float u_pr;

out vec4 fragColor;

vec3 colorFromInt(int color) {
  int r = (color >> 16) & 0xFF;
  int g = (color >> 8) & 0xFF;
  int b = color & 0xFF;
  return vec3(float(r), float(g), float(b)) / 255.0;
}

void main() {
  if (gl_FragCoord.x >= v_right || gl_FragCoord.y >= v_bottom) {
    discard;
  }
  else {
    float randomf = fract(sin(v_row_index * .1002) * 160.);
    vec3 color = colorFromInt(
      0xdd0000
      + int(randomf * float(0x111111))
    );
    fragColor = vec4(color, 1.0);
  }
}
`

export function Boxes(GL: GL, world: World, boxes: Float32Array) {
  using $ = Signal()

  const { view, matrix } = world
  const { gl } = GL

  const info = MeshInfo(GL, {
    vertex,
    fragment,
    vao: {
      a_vert_pos: [gl.ARRAY_BUFFER, (index, target, usage) => {
        const rect = new Float32Array([
          1.0, 1.0,
          -1.0, 1.0,
          1.0, -1.0,
          -1.0, -1.0,
        ])
        gl.bufferData(target, rect, usage)
        gl.vertexAttribPointer(index, 2, gl.FLOAT, false, 0, 0)
        return rect
      }],
      a_box_pos: [gl.ARRAY_BUFFER, (index, target, usage) => {
        gl.bufferData(target, boxes, usage)
        gl.vertexAttribPointer(index, 4, gl.FLOAT, false, 0, 0)
        gl.vertexAttribDivisor(index, 1)
        return boxes
      }],
    }
  })

  const {
    u_matrix,
    u_screen,
    u_pr,
    u_gap_x,
    u_gap_y,
  } = info.uniforms

  const mat3fv = new Float64Array(9)

  $.fx(() => {
    const { pr } = view
    const { a, d, e, f } = matrix
    $()
    info.useProgram()
    mat3fv.set(matrix.values)
    mat3fv[6] *= view.pr
    mat3fv[7] *= view.pr
    gl.uniformMatrix3fv(u_matrix, false, mat3fv)
    gl.uniform1f(u_gap_x, a > pr ? pr : 0)
  })

  $.fx(() => {
    const { w_pr, h_pr, pr } = view
    $()
    info.useProgram()
    gl.uniform2f(u_screen, w_pr, h_pr)
    gl.uniform1f(u_pr, pr)
    gl.uniform1f(u_gap_y, pr)
  })

  function draw() {
    info.use()

    // const { w_pr: w, h_pr: h, x_pr: x, y_pr: y } = view

    // gl.enable(gl.SCISSOR_TEST)
    // console.log(x_pr, y_pr_i, w, h, boxes.length / 4)
    // console.log(x_pr, y_pr_i, w, h)
    // gl.viewport(x, y, w, h)
    view.viewport(gl)
    // gl.viewport(0, 0, 300, 700)
    // gl.scissor(x_pr, y_pr_i, w, h)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, boxes.length / 4)
    // gl.disable(gl.SCISSOR_TEST)
  }

  // $.fx(() => () => {
  //   GL.deleteShaders(shaders)
  //   gl.deleteProgram(program)
  //   gl.deleteVertexArray(vao)
  //   GL.deleteAttribs(attribs)
  // })

  return { draw }
}
