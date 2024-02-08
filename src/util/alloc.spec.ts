import { alloc } from './alloc.ts'

describe('alloc', () => {
  it('works', () => {
    const buf = alloc(Float32Array, 32)
    expect(buf.length).toBe(32)
    expect(buf).toBeInstanceOf(Float32Array)
  })
})
