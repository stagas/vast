import { GL, initGL } from 'gl-util'
import { Signal } from 'signal-jsx'
import { Rect } from 'std'
import { state } from './state.ts'
import { World } from './world/world.ts'
import { MAX_GL_INSTANCES } from '../as/assembly/sketch-shared.ts'

const DEBUG = true

export interface MeshProps {
  GL: GL
  view: Rect
}

export interface Mesh {
  draw(): void
}

export function WebGL(world: World, canvas: HTMLCanvasElement) {
  DEBUG && console.log('[webgl] create')
  using $ = Signal()

  const { view } = world

  const GL = initGL(canvas, {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true
  })

  const { gl } = GL

  function clear() {
    gl.viewport(0, 0, view.w_pr, view.h_pr)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  }

  function draw() {
    clear()
    for (const mesh of state.meshes) {
      mesh.draw()
    }
  }

  world.anim.ticks.add(draw)

  function add($: Signal, mesh: Mesh) {
    $.fx(() => {
      state.meshes.add(mesh)
      return () => {
        state.meshes.delete(mesh)
      }
    })
  }

  $.fx(() => () => {
    DEBUG && console.log('[webgl] dispose')
    world.anim.ticks.delete(draw)
    state.meshes.clear()
  })

  return { GL, draw, add }
}
