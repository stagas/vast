import { GL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { MeshInfo } from '../mesh-info.ts'

const vertex = /*glsl*/`
#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5; // clip space to texture coordinates
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const fragment = /*glsl*/`
#version 300 es

precision highp sampler2D;
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 fragColor;

void main() {
  vec4 c = texture(u_texture, v_texCoord);
  fragColor = vec4(0.2, 0.2, c.b, 1.0);
}
`

function QuadInfo(GL: GL) {
  using $ = Signal()

  const { gl } = GL

  const info = MeshInfo(GL, {
    vertex,
    fragment,
    vao: {
      a_position: [gl.ARRAY_BUFFER, (index, target, usage) => {
        const data = new Float32Array([
          -1.0, -1.0,
          1.0, -1.0,
          -1.0, 1.0,
          1.0, 1.0,
        ])
        gl.bufferData(target, data, usage)
        gl.vertexAttribPointer(index, 2, gl.FLOAT, false, 0, 0)
        return data
      }],
    }
  })

  $.fx(() => () => {
    quad = null
  })

  return info
}

let quad: ReturnType<typeof QuadInfo> | null

export type Quad = ReturnType<typeof Quad>

export function Quad(GL: GL) {
  using $ = Signal()

  const { gl } = GL

  quad = QuadInfo(GL)

  const { use } = quad

  const texture = GL.createTexture(gl.TEXTURE_2D, quad.uniforms.u_texture, {
    [gl.TEXTURE_MIN_FILTER]: gl.LINEAR,
    [gl.TEXTURE_MAG_FILTER]: gl.LINEAR,
    [gl.TEXTURE_WRAP_S]: gl.CLAMP_TO_EDGE,
    [gl.TEXTURE_WRAP_T]: gl.CLAMP_TO_EDGE,
  })

  const textures = [texture]

  function draw() {
    use()
    GL.activateTextures(textures)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  $.fx(() => () => {
    GL.deleteTextures(textures)
  })

  return { draw, texture }
}
