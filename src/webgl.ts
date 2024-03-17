import { GL, initGL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { state } from './state.ts'
import { World } from './world/world.ts'

const DEBUG = false

export interface MeshProps {
  GL: GL
  view: Rect
}

export interface Mesh {
  draw(): void
}

export function WebGL(view: Rect, canvas: HTMLCanvasElement, alpha = false) {
  DEBUG && console.log('[webgl] create')
  using $ = Signal()

  const GL = initGL(canvas, {
    antialias: true,
    alpha,
    preserveDrawingBuffer: true
  })

  const { gl } = GL
  const meshes = new Set<Mesh>()

  function clear() {
    gl.viewport(0, view.y_pr, Math.max(0, view.w_pr), Math.max(0, view.h_pr))
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  }

  function draw() {
    clear()
    for (const mesh of meshes) {
      mesh.draw()
    }
  }

  function add($: Signal, mesh: Mesh) {
    $.fx(() => {
      meshes.add(mesh)
      return () => {
        meshes.delete(mesh)
      }
    })
  }

  $.fx(() => () => {
    DEBUG && console.log('[webgl] dispose')
    meshes.clear()
    GL.reset()
  })

  return { GL, draw, add }
}
