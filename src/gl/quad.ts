import { GL } from 'gl-util'
import { fx } from 'signal-jsx'
import { once } from 'utils'

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
  fragColor = texture(u_texture, v_texCoord);
}
`

let quadCommon: ReturnType<typeof QuadCommon> | null

function QuadCommon(GL: GL) {
  const { gl } = GL

  const shaders = GL.createShaders({ vertex, fragment })
  const program = GL.createProgram(shaders)
  const vao = GL.createVertexArray()

  const attribs = GL.addVertexAttribs({
    a_position: [gl.ARRAY_BUFFER, (index, target) => {
      const srcData = new Float32Array([
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        1.0, 1.0,
      ])
      gl.bufferData(target, srcData, gl.STATIC_DRAW)
      gl.vertexAttribPointer(index, 2, gl.FLOAT, false, 0, 0)
    }],
  })

  const {
    u_texture,
  } = GL.uniforms

  fx(() => () => {
    GL.deleteShaders(shaders)
    gl.deleteProgram(program)
    gl.deleteVertexArray(vao)
    GL.deleteAttribs(attribs)
    quadCommon = null
  })

  return { program, vao, u_texture }
}

export type Quad = ReturnType<typeof Quad>

export function Quad(GL: GL) {
  const { gl } = GL

  quadCommon ??= QuadCommon(GL)

  const { program, vao, u_texture } = quadCommon

  const texture = GL.createTexture(gl.TEXTURE_2D, u_texture, {
    [gl.TEXTURE_MIN_FILTER]: gl.LINEAR,
    [gl.TEXTURE_MAG_FILTER]: gl.LINEAR,
    [gl.TEXTURE_WRAP_S]: gl.CLAMP_TO_EDGE,
    [gl.TEXTURE_WRAP_T]: gl.CLAMP_TO_EDGE,
  })

  const textures = [texture]

  function draw() {
    GL.use(program, vao)
    GL.activateTextures(textures)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const dispose = once(() => {
    GL.deleteTextures(textures)
  })

  fx(() => dispose)

  return { draw, texture, dispose }
}
