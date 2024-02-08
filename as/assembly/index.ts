import { BOOLS, LINE_CAP_ROUND, LINE_CAP_SQUARE, LINE_CAP_START_BIT, LINE_JOIN_ROUND, LINE_JOIN_START_BIT, MAX_INSTANCES } from './constants'
import { logf, logf6 } from './env'

export function add(x: f32, y: f32): f32 {
  return x + y
}

export function doit(ptr: usize): void {
  const x: StaticArray<f32> = changetype<StaticArray<f32>>(ptr)
  for (let i = 0; i < x.length; i++) {
    x[i] = f32(i) * 2 + x[i]
  }
}

function clamp255(x: f32): i32 {
  if (x < 0) return 0
  if (x > 255) return 255
  return i32(x)
}
function magnitude(x: f32, y: f32): f32 {
  const sum: f32 = x * x + y * y
  if (sum === 0.0) return 0.0
  return Mathf.sqrt(sum)
}

type Matrix = StaticArray<f32>

@unmanaged
class GLState {
  globalAlpha: f32 = 1.0
  instancePointer: u32 = 0
  transformScaleX: f32 = 0
  transformScaleY: f32 = 0
  transformMatrix: Matrix = new StaticArray<f32>(6)
}

@unmanaged
class Attributes {
  vertexColor: usize = 0
  vertexAlpha: usize = 0
  vertexLineWidth: usize = 0
  vertexTextureYAxis: usize = 0
  vertexTextureZAxis: usize = 0
  vertexTransformRow1: usize = 0
  vertexTransformRow2: usize = 0
  vertexBooleans: usize = 0
}

export function createGLState(): usize {
  return changetype<usize>(new GLState())
}

export function getGLStateMatrix(ptr: usize): usize {
  const glState = changetype<GLState>(ptr)
  return changetype<usize>(glState.transformMatrix)
}

export function createAttributes(): usize {
  return changetype<usize>(new Attributes())
}

// @ts-ignore
@inline
function putSize1(ptr: usize, index: u32, x: f32): void {
  ptr += index << 2
  f32.store(ptr, x)
}
// @ts-ignore
@inline
function putSize2(ptr: usize, index: u32, x: f32, y: f32): void {
  index *= 2
  ptr += index << 2
  f32.store(ptr, x)
  f32.store(ptr, y, 4)
}
// @ts-ignore
@inline
function putSize3(ptr: usize, index: u32, x: f32, y: f32, z: f32): void {
  index *= 3
  ptr += index << 2
  f32.store(ptr, x)
  f32.store(ptr, y, 4)
  f32.store(ptr, z, 8)
}

function render(): void {
  //
}

const floats = new StaticArray<f32>(2048)

let t: f32 = 0
export function drawWave(
  glState$: usize,
  attributes$: usize,
  x: i32, y: i32, w: i32, h: i32,
): void {
  const coeff: f32 = f32(floats.length) / f32(w)

  for (let i = 0; i < floats.length; i++) {
    unchecked(floats[i] = Mathf.sin(((t + f32(i) * f32(i * 0.0114)) / 2048) * 200))
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
    lineInstance(
      glState$,
      attributes$,
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

export function drawWaves(
  glState$: usize,
  attributes$: usize,
  x: i32, y: i32, w: i32, h: i32,
): void {
  for (let i = 0; i < 12; i++) {
    drawWave(glState$, attributes$, x, y, w, h)
    y += h
  }

  t++
}

export function lineInstance(
  glState$: usize,
  attributes$: usize,
  ax: f32, ay: f32, bx: f32, by: f32,
  lineWidth: f32, lineCap: i32, lineJoin: i32,
  r: f32, g: f32, b: f32, a: f32,
  leftCap: boolean, rightCap: boolean
): void {
  const glState = changetype<GLState>(glState$)
  const attributes = changetype<Attributes>(attributes$)

  // do vector math
  const vx: f32 = bx - ax
  const vy: f32 = by - ay
  const mag: f32 = magnitude(vx, vy)
  const mag1: f32 = 1.0 / mag
  const nx: f32 = -vy * mag1
  const ny: f32 = vx * mag1
  const lw2: f32 = lineWidth * 0.5

  const extendedJoin = lineJoin === LINE_JOIN_ROUND
  const extendedCap = lineCap === LINE_CAP_SQUARE || lineCap === LINE_CAP_ROUND

  const extendLeft = leftCap ? extendedCap : extendedJoin
  const extendRight = rightCap ? extendedCap : extendedJoin

  if (extendLeft || extendRight) {
    const factor: f32 = lw2 * mag1
    const nvx: f32 = vx * factor
    const nvy: f32 = vy * factor

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
  const m00: f32 = bx - ax
  const m01: f32 = by - ay
  const m10: f32 = nx * lineWidth
  const m11: f32 = ny * lineWidth
  const m20: f32 = ax - nx * lw2
  const m21: f32 = ay - ny * lw2

  // create instance
  const transformMatrix = glState.transformMatrix
  const M00 = unchecked(transformMatrix[0])
  const M10 = unchecked(transformMatrix[1])
  const M20 = unchecked(transformMatrix[2])
  const M01 = unchecked(transformMatrix[3])
  const M11 = unchecked(transformMatrix[4])
  const M21 = unchecked(transformMatrix[5])

  // logf6(M00, M10, M20, M01, M11, M21)

  const index = glState.instancePointer

  const vertexColor = attributes.vertexColor
  const vertexAlpha = attributes.vertexAlpha
  const vertexLineWidth = attributes.vertexLineWidth
  const vertexTextureYAxis = attributes.vertexTextureYAxis
  const vertexTransformRow1 = attributes.vertexTransformRow1
  const vertexTransformRow2 = attributes.vertexTransformRow2
  const vertexBooleans = attributes.vertexBooleans

  putSize1(vertexColor, index, f32(clamp255(r) << 16 | clamp255(g) << 8 | clamp255(b)))
  putSize1(vertexAlpha, index, a * glState.globalAlpha)
  putSize1(vertexLineWidth, index, lineWidth)
  putSize2(vertexTextureYAxis, index, glState.transformScaleX, glState.transformScaleY)
  putSize3(vertexTransformRow1, index, M00 * m00 + M10 * m01, M00 * m10 + M10 * m11, M00 * m20 + M10 * m21 + M20)
  putSize3(vertexTransformRow2, index, M01 * m00 + M11 * m01, M01 * m10 + M11 * m11, M01 * m20 + M11 * m21 + M21)
  putSize1(vertexBooleans, index, f32(BOOLS.LINE_SEGMENT | (leftCap ? BOOLS.LEFT_LINE_CAP : 0) | (rightCap ? BOOLS.RIGHT_LINE_CAP : 0) | lineCap << LINE_CAP_START_BIT | lineJoin << LINE_JOIN_START_BIT))

  glState.instancePointer++
}
