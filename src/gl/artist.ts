import wasm from 'assembly'
import { GL } from 'gl-util'
import { $, fx } from 'signal-jsx'
import { Rect } from 'std'
import { defineStruct, once } from 'utils'
import { BOOLS, LINE_CAP_ROUND, LINE_CAP_SQUARE, LINE_CAP_START_BIT, LINE_JOIN_ROUND, LINE_JOIN_START_BIT, MAX_INSTANCES } from '../../as/assembly/constants.ts'
import { alloc } from '../util/alloc.ts'

interface GLState {
  instancePointer: number
  vertexCount: number
  renderedInstances: number
  drawCalls: number
  TEXTURE_SLOT_SIZE: number
  TEXTURE_SLOT_PIXEL_SIZE: number
  MAX_TEXTURE_SLOTS: number
}

const sources = (glState: GLState, debugSlots: number) => {
  const webgl2 = !!window.WebGL2RenderingContext
  const macros = /*glsl*/`
    #define rshift(a, b) ${webgl2 ? "(a >> b)" : "(a / int(pow(2.0, float(b))))"}
    ${webgl2 ? "#define and(a, b) (a & b)" : /*glsl*/`
    int and(int a, int b) {
      int result = 0;
      for (int i = 0; i < 23; i++) {
        if (a == 0 && b == 0) return result;
        float fA = mod(float(a), 2.0);
        float fB = mod(float(b), 2.0);
        a /= 2;
        b /= 2;
        result += int(pow(2.0, float(i)) * fA * fB);
      }
      return result;
    }
  `}
    #define boolean(b) (and(iBooleans, b) != 0)
  `
  const textureSelector = webgl2 ? `						switch (iTextureIndex) {
${new Array(glState.MAX_TEXTURE_SLOTS).fill(0).map((_, i) =>
    `							case ${i}: pixelColor = texture(textures[${i}], tuv); break;`
  ).join("\n")}
						}` : new Array(glState.MAX_TEXTURE_SLOTS).fill(0).map((_, i) =>
    `						${i ? "else " : ""}if (iTextureIndex == ${i}) pixelColor = texture(textures[${i}], tuv);`
  ).join("\n")

  return {
    vertex: /*glsl*/`
#version 300 es
precision highp float;
precision highp sampler2D;

uniform vec2 resolution;

in float vertexID;
in float vertexColor;
in float vertexAlpha;
in float vertexLineWidth;
in vec3 vertexTransformRow1;
in vec3 vertexTransformRow2;
in float vertexTextureIndex;
in vec2 vertexTextureYAxis;
in vec2 vertexTextureZAxis;
in float vertexBooleans;

out vec2 uv;
out vec2 size;
out vec3 color;
out float alpha;
out float lineWidth;
out vec2 scaleFactor;
out float textureIndex;
out vec2 textureCoord;
out vec2 textureCoordMin;
out vec2 textureCoordMax;
out float booleans;

${macros}

void main() {
  vec2 vertexPosition = vec2(
    mod(vertexID, 2.0),
    floor(vertexID / 2.0)
  ); // generate vertices for square

  mat3 transform = mat3(
    vertexTransformRow1.x, vertexTransformRow2.x, 0.0,
    vertexTransformRow1.y, vertexTransformRow2.y, 0.0,
    vertexTransformRow1.z, vertexTransformRow2.z, 1.0
  );
  vec2 position = (transform * vec3(vertexPosition, 1.0)).xy;

  position /= resolution * 0.5;
  position -= 1.0;
  position.y *= -1.0;

  gl_Position = vec4(position, 0.0, 1.0);
  int iColor = int(vertexColor);
  color = vec3(
    rshift(iColor, 16),
    mod(float(rshift(iColor, 8)), 256.0),
    mod(float(iColor), 256.0)
  ) / 255.0;
  alpha = vertexAlpha;

  uv = vertexPosition;

  size = vec2(length(transform[0]), length(transform[1]));
  booleans = vertexBooleans;
  lineWidth = vertexLineWidth;
  scaleFactor = vertexTextureYAxis;

  int iBooleans = int(booleans);
  if (boolean(${BOOLS.TEXTURED})) {
    textureIndex = vertexTextureIndex;

    vec2 vertexTextureXAxis = vec2(vertexColor, vertexLineWidth);
    textureCoord = vertexPosition.x * vertexTextureXAxis + vertexPosition.y * vertexTextureYAxis + vertexTextureZAxis;
    bool pixelated = boolean(${BOOLS.PIXELATED});

    vec2 tmin = vertexTextureZAxis;

    if (boolean(${BOOLS.TRIANGLE})) {
      vec2 tmax1 = vertexTextureZAxis + vertexTextureXAxis;
      vec2 tmax2 = vertexTextureZAxis + vertexTextureYAxis;
      textureCoordMin = min(tmin, min(tmax1, tmax2));
      textureCoordMax = max(tmin, max(tmax1, tmax2));
    } else {
      vec2 tmax = vertexTextureXAxis + vertexTextureYAxis + vertexTextureZAxis;

      textureCoordMin = min(tmin, tmax);
      textureCoordMax = max(tmin, tmax);
    }

    float inset = (pixelated ? 0.0001 : 0.5) * ${glState.TEXTURE_SLOT_PIXEL_SIZE};
    textureCoordMin += inset;
    textureCoordMax -= inset;

    if (min(textureCoordMin, textureCoordMax) != textureCoordMin) { // sub pixel
      vec2 pixelf = (textureCoordMin + textureCoordMax) * 0.5;
      vec2 pixeli = (floor(pixelf / ${glState.TEXTURE_SLOT_PIXEL_SIZE}) + 0.5) * ${glState.TEXTURE_SLOT_PIXEL_SIZE};
      textureCoordMin = textureCoordMax = pixeli;
    }
  }
}
`,
    fragment: /*glsl*/`
#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D textures[${glState.MAX_TEXTURE_SLOTS}];
uniform int renderPass;

in vec2 uv;
in vec2 size;
in vec3 color;
in float alpha;
in float lineWidth;
in vec2 scaleFactor;
in float textureIndex;
in float booleans;
in vec2 textureCoord;
in vec2 textureCoordMin;
in vec2 textureCoordMax;

out vec4 finalColor;

#define SQRT_2 1.41421356237

${macros}

void main() {
  int iBooleans = int(booleans);

  float px;
  float antialias = 1.0;

  // finalColor = vec4(0.0, 0.0, 0.0, 0.1);
  // return;

  // // debug (triangulation)
  // finalColor = vec4(0.0, 0.0, 0.0, 0.0);
  // float csc = max(size.x, size.y);
  // if (
  // 	abs(uv.x * csc - (1.0 - uv.y) * csc) < 1.0
  // 	|| abs(uv.x - 0.5) > 0.5 - 1.0 / size.x
  // 	|| abs(uv.y - 0.5) > 0.5 - 1.0 / size.y
  // ) finalColor = vec4(1.0);
  // return;

  // vec3 color = vec3(1.0, 0.0, 0.0);
  // float alpha = 1.0;

  if (boolean(${BOOLS.CIRCLE})) {
    px = length(1.0 / size);
    vec2 cuv = uv - 0.5;
    float len = length(cuv);
    if (len > 0.5) discard;
    antialias *= smoothstep(0.5, 0.5 - px, len);

    if (boolean(${BOOLS.OUTLINED})) {
      vec2 cuv = uv - 0.5;
      cuv /= 1.0 - 2.0 * lineWidth * scaleFactor / size;
      float len = length(cuv);
      if (len < 0.5 - px) discard;
      antialias *= smoothstep(0.5 - px, 0.5, len);
    }
  } else if (boolean(${BOOLS.TRIANGLE})) {
    float d = dot(uv, vec2(SQRT_2));
    px = length(1.0 / size);
    if (d > SQRT_2 + px) discard;
    antialias *= smoothstep(SQRT_2 + px, SQRT_2, d);
  } else if (boolean(${BOOLS.LINE_SEGMENT})) {
    int lineCap = and(rshift(iBooleans, ${LINE_CAP_START_BIT}), ${0b11});
    int lineJoin = and(rshift(iBooleans, ${LINE_JOIN_START_BIT}), ${0b11});

    bool lineCapLeft = boolean(${BOOLS.LEFT_LINE_CAP});
    bool lineCapRight = boolean(${BOOLS.RIGHT_LINE_CAP});

    bool lineJoinRound = lineJoin == ${LINE_CAP_ROUND};
    bool lineCapRound = lineCap == ${LINE_CAP_ROUND};

    bool roundLeft = lineCapLeft ? lineCapRound : lineJoinRound;
    bool roundRight = lineCapRight ? lineCapRound : lineJoinRound;

    // add rounded edges
    vec2 suv = uv * size;
    float radius = size.y * 0.5;

    if (roundLeft && suv.x < radius) {
      float len = length(suv - radius);
      if (len > radius) discard;
      antialias *= smoothstep(radius, radius - 1.0, len);
    }

    if (roundRight && size.x - suv.x < radius) {
      float len = length(suv - vec2(size.x - radius, radius));
      if (len > radius) discard;
      antialias *= smoothstep(radius, radius - 1.0, len);
    }
  } else { // quad
    if (boolean(${BOOLS.OUTLINED})) {
      vec2 d = lineWidth * scaleFactor / size;
      vec2 dist = 0.5 - abs(uv - 0.5);
      vec2 px = 1.0 / size;
      if (dist.x > d.x + px.x && dist.y > d.y + px.y) discard;
      vec2 aa = smoothstep(d + px, d, dist);
      antialias *= aa.x + aa.y;
    }
  }

  vec4 pixelColor = vec4(color, 1.0);
  if (boolean(${BOOLS.TEXTURED})) {
    vec2 tuv = clamp(textureCoord, textureCoordMin, textureCoordMax);
    if (boolean(${BOOLS.PIXELATED})) tuv = (floor(tuv / ${glState.TEXTURE_SLOT_PIXEL_SIZE}) + 0.5) * ${glState.TEXTURE_SLOT_PIXEL_SIZE};
    int iTextureIndex = int(textureIndex);
${textureSelector}
  } else {
${new Array(debugSlots).fill(0).map((_, i) =>
      `						{
      float minX = ${(i / debugSlots).toFixed(10)};
      float maxX = ${((i + 1) / debugSlots).toFixed(10)};
      if (uv.x > minX && uv.x < maxX) pixelColor = texture(
        textures[${i}], vec2(
          (uv.x - minX) / (maxX - minX),
          uv.y
        )
      );
    };`
    ).join("\n")}
  }

  // pixelColor = vec4(1.0, 0.0, 0.0, 1.0);

  // pixelColor.a += float(renderPass) / 5.0;

  finalColor = vec4(pixelColor.rgb, pixelColor.a * alpha * antialias);
  finalColor.a = clamp(finalColor.a, 0.0, 1.0);
  finalColor.rgb *= finalColor.a;
}
`,
  }
}

// const vertex = (macros: string, glState: any) =>
let artistCommon: ReturnType<typeof ArtistCommon> | null

function ArtistCommon(GL: GL, view: Rect) {
  const { gl } = GL

  const TEXTURE_SLOT_SIZE = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
  const glState: GLState = {
    instancePointer: 0,
    vertexCount: 0,
    MAX_TEXTURE_SLOTS: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
    TEXTURE_SLOT_SIZE,
    TEXTURE_SLOT_PIXEL_SIZE: 1 / TEXTURE_SLOT_SIZE,
    renderedInstances: 0,
    drawCalls: 0
  }
  const debugSlots = 0//glState.MAX_TEXTURE_SLOTS;

  const src = sources(glState, debugSlots)
  const shaders = GL.createShaders(src)
  const program = GL.createProgram(shaders)
  const vao = GL.createVertexArray()

  gl.uniform1iv(GL.uniforms.textures, new Int32Array(glState.MAX_TEXTURE_SLOTS).map((_, i) => i))

  function attribute(name: string, size: number, instanced: boolean, putFunction: any, data?: Float32Array | undefined) {
    const attr = {
      name,
      pointer: gl.getAttribLocation(program, name),
      size,
      instanced,
      buffer: gl.createBuffer(),
      data: data ? data : alloc(Float32Array, MAX_INSTANCES * size),
      changed: true,
      enabled: false,
      put: putFunction,
      set(start: number, end: number, done?: boolean) {
        if (true || this.changed) {
          if (done) this.changed = false

          if (!this.enabled) {
            this.enabled = true
            gl.enableVertexAttribArray(this.pointer)
            gl.vertexAttribDivisor(this.pointer, +instanced)
          }

          gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
          const byteOffset = start * this.size //* Float32Array.BYTES_PER_ELEMENT
          const length = (end - start) * this.size
          const view = this.data.subarray(byteOffset, byteOffset + length)
          // console.log(view)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, view)
          gl.vertexAttribPointer(this.pointer, this.size, gl.FLOAT, false, 0, 0)
        }
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, attr.data.length * 4, gl.DYNAMIC_DRAW)
    if (data) attr.set(0, data.length / size)

    return attr
  }

  type Attr = ReturnType<typeof attribute>

  // attributes
  glState.instancePointer = 0

  function putSize1(this: Attr, index: number, x: number) {
    this.data[index * this.size] = x
    this.changed = true
  }

  function putSize2(this: Attr, index: number, x: number, y: number) {
    index *= this.size
    this.data[index] = x
    this.data[index + 1] = y
    this.changed = true
  }

  function putSize3(this: Attr, index: number, x: number, y: number, z: number) {
    index *= this.size
    this.data[index] = x
    this.data[index + 1] = y
    this.data[index + 2] = z
    this.changed = true
  }

  const position = attribute("vertexID", 1, false, putSize1, new Float32Array([0, 1, 2, 3]))
  glState.vertexCount = position.data.length / position.size

  const color = attribute("vertexColor", 1, true, putSize1)
  const alpha = attribute("vertexAlpha", 1, true, putSize1)
  const lineWidth = attribute("vertexLineWidth", 1, true, putSize1)
  const textureIndex = attribute("vertexTextureIndex", 1, true, putSize1)
  const textureYAxis = attribute("vertexTextureYAxis", 2, true, putSize2)
  const textureZAxis = attribute("vertexTextureZAxis", 2, true, putSize2)
  const transformRow1 = attribute("vertexTransformRow1", 3, true, putSize3)
  const transformRow2 = attribute("vertexTransformRow2", 3, true, putSize3)
  const booleans = attribute("vertexBooleans", 1, true, putSize1)

  // write attribute data pointers to wasm
  const attributes$ = wasm.createAttributes()
  const Attributes = defineStruct({
    vertexColor: 'usize',
    vertexAlpha: 'usize',
    vertexLineWidth: 'usize',
    vertexTextureYAxis: 'usize',
    vertexTextureZAxis: 'usize',
    vertexTransformRow1: 'usize',
    vertexTransformRow2: 'usize',
    vertexBooleans: 'usize',
  })
  const wasmAttributes = Attributes(wasm.memory.buffer, attributes$)
  wasmAttributes.vertexColor = color.data.byteOffset
  wasmAttributes.vertexAlpha = alpha.data.byteOffset
  wasmAttributes.vertexLineWidth = lineWidth.data.byteOffset
  wasmAttributes.vertexTextureYAxis = textureYAxis.data.byteOffset
  wasmAttributes.vertexTextureZAxis = textureZAxis.data.byteOffset
  wasmAttributes.vertexTransformRow1 = transformRow1.data.byteOffset
  wasmAttributes.vertexTransformRow2 = transformRow2.data.byteOffset
  wasmAttributes.vertexBooleans = booleans.data.byteOffset

  const attributes = {
    color, alpha, lineWidth,
    textureIndex, textureZAxis, textureYAxis,
    transformRow1, transformRow2,
    booleans,
  }

  const { resolution } = GL.uniforms

  fx(() => {
    const { width, height } = view
    $()
    GL.useProgram(program)
    gl.uniform2f(resolution, width, height)
  })

  fx(() => () => {
    GL.deleteShaders(shaders)
    gl.deleteProgram(program)
    gl.deleteVertexArray(vao)
    artistCommon = null
  })

  // const { renderPass } = GL.uniforms
  function renderRange(start: number, end: number, done = false) {
    if (start >= end) return

    attributes.color.set(start, end, done)
    attributes.alpha.set(start, end, done)
    attributes.lineWidth.set(start, end, done)
    attributes.textureIndex.set(start, end, done)
    attributes.textureYAxis.set(start, end, done)
    attributes.textureZAxis.set(start, end, done)
    attributes.transformRow1.set(start, end, done)
    attributes.transformRow2.set(start, end, done)
    attributes.booleans.set(start, end, done)

    // window.batchSizes.push(end - start);
    // window.batchUnits.push([...glState.spriteSheets.activeSpriteSheets].sort((a, b) => a.textureUnit - b.textureUnit).map(sheet => sheet.id));

    // gl.uniform1i(renderPass, glState.drawCalls)

    const instances = end - start
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, glState.vertexCount, instances)

    // performance stats
    glState.renderedInstances += instances
    glState.drawCalls++
  }

  const WasmGLState = defineStruct({
    globalAlpha: 'f32',
    instancePointer: 'u32',
    transformScaleX: 'f32',
    transformScaleY: 'f32',
    transformMatrix: 'usize',
  })
  const m = new Float32Array(9)
  m[0] = 1
  m[4] = 1
  const wasmGLState$ = wasm.createGLState()
  const wasmGLState = WasmGLState(wasm.memory.buffer, wasmGLState$)
  const transformMatrix = new Float32Array(wasm.memory.buffer, wasmGLState.transformMatrix, 6)

  function setTransform(transform: Float32Array) {
    const m00 = transform[0]
    const m01 = transform[1]
    const m10 = transform[3]
    const m11 = transform[4]
    const m20 = transform[6]
    const m21 = transform[7]

    const matrix = transformMatrix
    matrix[0] = m00
    matrix[1] = m10
    matrix[2] = m20
    matrix[3] = m01
    matrix[4] = m11
    matrix[5] = m21
    wasmGLState.transformScaleX = Math.sqrt(m00 * m00 + m01 * m01)
    wasmGLState.transformScaleY = Math.sqrt(m10 * m10 + m11 * m11)
  }
  setTransform(m)

  function flush() {
    let start = 0
    let end = 0

    renderRange(start, wasmGLState.instancePointer, true)
  }

  function clamp255(number: number) {
    if (number < 0) return 0
    if (number > 255) return 255
    return number
  }
  function magnitude(x: number, y: number) {
    const sum = x * x + y * y
    if (sum === 0) return 0
    return Math.sqrt(sum)
  }
  function dot(x1: number, y1: number, x2: number, y2: number) {
    return x1 * x2 + y1 * y2
  }
  function cross(x1: number, y1: number, x2: number, y2: number) {
    return x1 * y2 - y1 * x2
  }

  function lineInstance(
    ax: number, ay: number, bx: number, by: number,
    _lineWidth: number, lineCap: number, lineJoin: number,
    r: any, g: any, b: any, a: number,
    leftCap: boolean, rightCap: boolean
  ) {
    // if (!glState.hasContext) return
    // guarenteeWebGLObjects()

    // do vector math
    const vx = bx - ax
    const vy = by - ay
    const mag = magnitude(vx, vy)
    const mag1 = 1 / mag
    const nx = -vy * mag1
    const ny = vx * mag1
    const lw2 = _lineWidth * 0.5

    const extendedJoin = lineJoin === LINE_JOIN_ROUND
    const extendedCap = lineCap === LINE_CAP_SQUARE || lineCap === LINE_CAP_ROUND

    const extendLeft = leftCap ? extendedCap : extendedJoin
    const extendRight = rightCap ? extendedCap : extendedJoin

    if (extendLeft || extendRight) {
      const factor = lw2 * mag1
      const nvx = vx * factor
      const nvy = vy * factor

      if (extendLeft) {
        ax -= nvx
        ay -= nvy
      }
      if (extendRight) {
        bx += nvx
        by += nvy
      }

    }


    // construct transform
    const m00 = bx - ax
    const m01 = by - ay
    const m10 = nx * _lineWidth
    const m11 = ny * _lineWidth
    const m20 = ax - nx * lw2
    const m21 = ay - ny * lw2

    // create instance
    // const { transformMatrix } = glState
    const M00 = transformMatrix[0]
    const M10 = transformMatrix[1]
    const M20 = transformMatrix[2]
    const M01 = transformMatrix[3]
    const M11 = transformMatrix[4]
    const M21 = transformMatrix[5]

    const index = wasmGLState.instancePointer
    const {
      color,
      alpha,
      lineWidth,
      textureYAxis,
      transformRow1,
      transformRow2,
      booleans
    } = attributes

    color.put(index, clamp255(r) << 16 | clamp255(g) << 8 | clamp255(b))
    alpha.put(index, a * wasmGLState.globalAlpha)
    lineWidth.put(index, _lineWidth)
    textureYAxis.put(index, wasmGLState.transformScaleX, wasmGLState.transformScaleY)
    transformRow1.put(index, M00 * m00 + M10 * m01, M00 * m10 + M10 * m11, M00 * m20 + M10 * m21 + M20)
    transformRow2.put(index, M01 * m00 + M11 * m01, M01 * m10 + M11 * m11, M01 * m20 + M11 * m21 + M21)
    booleans.put(index, BOOLS.LINE_SEGMENT | (leftCap ? BOOLS.LEFT_LINE_CAP : 0) | (rightCap ? BOOLS.RIGHT_LINE_CAP : 0) | lineCap << LINE_CAP_START_BIT | lineJoin << LINE_JOIN_START_BIT)

    wasmGLState.instancePointer++
    // if (glState.instancePointer === MAX_INSTANCES) render()
  }


  const floats = new Float32Array(2048)

  type i32 = number
  type f32 = number
  function f32(x: number) { return x }
  function i32(x: number) { return Math.floor(x) }
  function unchecked(x: any) { return x }

  let t = 0
  function drawWave(
    // glState$: usize,
    // attributes$: usize,
    x: i32, y: i32, w: i32, h: i32,
  ): void {
    const coeff: f32 = f32(floats.length) / f32(w)

    for (let i = 0; i < floats.length; i++) {
      unchecked(floats[i] = Math.sin(((t + f32(i) * f32(i * 0.0114)) / 2048) * 200))
    }

    let s: f32

    let hh: f32 = f32(h) / 2.0
    let ax: f32 = f32(x)
    let midy = f32(y) + hh
    let ay: f32 = midy + hh * unchecked(floats[0])
    let bx: f32
    let by: f32
    for (let i = 1; i < w; i++) {
      s = unchecked(floats[i32(f32(i) * coeff)])
      bx = ax + 1
      by = midy + s * hh
      // console.log(ax, ay, bx, by)
      lineInstance(
        // glState$,
        // attributes$,
        ax, ay,
        bx, by,
        1,
        LINE_CAP_ROUND, LINE_JOIN_ROUND,
        255, 255, 255, 255,
        false, false,
      )
      ax = bx
      ay = by
    }

    // logf(t)
  }

  function drawWaves(
    // glState$: usize,
    // attributes$: usize,
    x: i32, y: i32, w: i32, h: i32,
  ): void {
    for (let i = 0; i < 12; i++) {
      drawWave(x, y, w, h)
      y += h
    }

    t++
  }

  function render() {
    wasmGLState.instancePointer = 0
    // lineInstance(
    //   0, 0, 50, 50,
    //   10,
    //   LINE_CAP_ROUND, LINE_JOIN_ROUND,
    //   255, 255, 255, 255,
    //   false, false,
    // )
    // lineInstance(
    //   50, 50, 80, 160,
    //   5,
    //   LINE_CAP_ROUND, LINE_JOIN_ROUND,
    //   255, 255, 255, 255,
    //   false, false,
    // )
    // console.log(booleans.data)
    // drawWaves(
    //   0, 1, view.width, view.height / 12,
    // )
    wasm.drawWaves(
      wasmGLState$,
      attributes$,
      0, 1, view.width, view.height / 12,
    )
    // wasm.lineInstance(
    //   wasmGLState$,
    //   attributes$,
    //   0, 0, 50, 50,
    //   10,
    //   LINE_CAP_ROUND, LINE_JOIN_ROUND,
    //   255, 255, 255, 255,
    //   false, false,
    // )
    // console.log('draw', wasmGLState.instancePointer)
    flush()
  }

  return { program, vao, render }
}

export type Artist = ReturnType<typeof Artist>

export function Artist(GL: GL, view: Rect) {
  const { gl } = GL

  artistCommon = ArtistCommon(GL, view)

  const { program, vao, render } = artistCommon

  // const texture = GL.createTexture(gl.TEXTURE_2D, u_texture, {
  //   [gl.TEXTURE_MIN_FILTER]: gl.LINEAR,
  //   [gl.TEXTURE_MAG_FILTER]: gl.LINEAR,
  //   [gl.TEXTURE_WRAP_S]: gl.CLAMP_TO_EDGE,
  //   [gl.TEXTURE_WRAP_T]: gl.CLAMP_TO_EDGE,
  // })

  // const textures = [texture]

  function draw() {
    GL.use(program, vao)
    render()
    // console.log('render')
    // GL.activateTextures(textures)
    // gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const dispose = once(() => {
    // GL.deleteTextures(textures)
  })

  fx(() => dispose)

  return { draw, dispose }
}
