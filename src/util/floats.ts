import wasm from 'assembly'

export type Floats = ReturnType<typeof Floats>

export function Floats(waveform: Float32Array) {
  const waveformLength = waveform.length

  // allocate wasm memory for the floats
  // and create mipmaps.
  const smallDivisor = 16
  const tinyDivisor = 4
  const steps = 2
  const smallCoeff = smallDivisor / steps
  const tinyCoeff = smallCoeff / tinyDivisor
  const smallLength = Math.floor(waveformLength / smallDivisor)
  const tinyLength = Math.floor(smallLength / tinyDivisor)

  const smallSize = smallLength * steps
  const tinySize = tinyLength * steps
  const pxSize = steps

  const smallPtr = waveformLength // distanced view
  const tinyPtr = smallPtr + smallSize // even more distanced
  const pxPtr = tinyPtr + tinySize // when < 1 pixel in width
  const size = pxPtr + pxSize

  const floats = wasm.alloc(Float32Array, size)
  floats.set(waveform)

  for (let n = 0; n < smallLength; n++) {
    const n0 = Math.floor(n * smallCoeff)
    const n1 = Math.ceil((n + 1) * smallCoeff)

    let min = Infinity, max = -Infinity
    let s
    for (let i = n0; i < n1; i++) {
      s = waveform[i]
      if (s < min) min = s
      else if (s > max) max = s
    }
    if (!isFinite(min)) min = 0
    if (!isFinite(max)) max = 0

    const p = smallPtr + n * steps
    floats[p] = min
    floats[p + 1] = max
  }

  for (let n = 0; n < tinyLength; n++) {
    const n0 = Math.floor(n * tinyCoeff)
    const n1 = Math.ceil((n + 1) * tinyCoeff)

    let min = Infinity, max = -Infinity
    let s
    for (let i = n0; i < n1; i++) {
      s = waveform[i]
      if (s < min) min = s
      if (s > max) max = s
    }
    if (!isFinite(min)) min = 0
    if (!isFinite(max)) max = 0

    const p = tinyPtr + n * steps
    floats[p] = min
    floats[p + 1] = max
  }

  {
    let min = Infinity, max = -Infinity
    let s
    for (let i = 0; i < waveformLength; i++) {
      s = waveform[i]
      if (s < min) min = s
      if (s > max) max = s
    }
    if (!isFinite(min)) min = 0
    if (!isFinite(max)) max = 0

    const p = pxPtr
    floats[p] = min
    floats[p + 1] = max

    // console.log(min, max)
    // console.log('small length', smallLength)
    // console.log('tiny length', tinyLength)
  }

  return floats
}
