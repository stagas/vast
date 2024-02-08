export function add(x: f32, y: f32): f32 {
  return x + y
}

export function doit(ptr: usize): void {
  const x: StaticArray<f32> = changetype<StaticArray<f32>>(ptr)
  for (let i = 0; i < x.length; i++) {
    x[i] = f32(i) + x[i]
  }
}
