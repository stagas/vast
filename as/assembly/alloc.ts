export function heap_alloc(size: usize): usize {
  return heap.alloc(size)
}

export function heap_free(ptr: usize): void {
  heap.free(ptr)
}
