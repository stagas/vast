/** @jsxImportSource signal-jsx */
import { $, fx, of } from 'signal-jsx'
import { Rect } from 'std'
import { Canvas } from './Canvas.tsx'
import { initGL } from 'gl-util'
import { Quad } from '../gl/quad.ts'
import { Artist } from '../gl/artist.ts'

export function WebGL() {
  const view = $(new Rect)
  view.w = window.innerWidth
  view.h = window.innerHeight - 44
  view.pr = window.devicePixelRatio

  const el = Canvas({ view })
  el.style.imageRendering = 'pixelated'

  const GL = initGL(el, {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true
  })

  const { gl } = GL

  function clear() {
    gl.viewport(0, 0, view.w_pr, view.h_pr)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  }

  // const quad = Quad(GL)
  const artist = Artist(GL, view)
  console.log(artist)

  function draw() {
    clear()
    artist.draw()
  }

  let animFrame: any
  function tick() {
    draw()
    animFrame = requestAnimationFrame(tick)
  }
  // requestAnimationFrame(draw)
  requestAnimationFrame(tick)

  fx(() => () => {
    cancelAnimationFrame(animFrame)
    artist.dispose()
    console.log('dispose')
  })

  return el
}
