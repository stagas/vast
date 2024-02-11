export type Floats = StaticArray<f32>

export function clamp255(x: f32): i32 {
  if (x > 255) x = 255
  else if (x < 0) x = 0
  return i32(x)
}

export function rgbToInt(r: f32, g: f32, b: f32): i32 {
  return (clamp255(r * 255) << 16) | (clamp255(g * 255) << 8) | clamp255(b * 255)
}
