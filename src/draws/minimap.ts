import { Signal } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { dom } from 'utils'
import { Canvas } from '../comp/Canvas.tsx'
import { log, state } from '../state.ts'
import { Grid } from './grid.ts'
import { CODE_WIDTH } from '../constants.ts'

const DEBUG = true

export type Minimap = ReturnType<typeof Minimap>

export function Minimap(grid: Grid) {
  using $ = Signal()

  const view = $(new Rect, { w: 250, h: 34, pr: state.$.pr })
  const handleView = $(new Rect, { w: 250, h: 38, pr: state.$.pr })

  const canvas = Canvas({ view })
  const handle = Canvas({ view: handleView })
  handle.style.position = 'absolute'
  handle.style.left = '0'
  handle.style.top = '0'
  canvas.style.marginBottom = '-1px'

  $.fx(() => dom.on(handle, 'wheel', e => {
    const m = grid.intentMatrix
    grid.mousePos.x = -m.e / m.a - CODE_WIDTH //+ grid.view.w / m.a / view.pr
    grid.mousePos.y = -m.f / m.d //+ grid.view.h / m.d / view.pr
    grid.handleWheelScaleX(e)
    log('wheel', grid.mousePos.x, grid.mousePos.y)
  }))

  $.fx(() => dom.on(handle, 'mousedown', e => {
    const rect = handle.getBoundingClientRect()

    function moveToTarget(e: MouseEvent) {
      const x = (e.pageX - rect.left) / view.w
      const y = (e.pageY - rect.top) / view.h
      const width = grid.info.boxes.right

      grid.intentMatrix.e = -x * width * grid.intentMatrix.a + grid.view.w / 2
      grid.lastFarMatrix.e = -x * width * grid.lastFarMatrix.a + grid.view.w / 2
    }

    const off = dom.on(window, 'mousemove', e => {
      e.stopImmediatePropagation()
      e.preventDefault()
      moveToTarget(e)
    })

    dom.on(window, 'mouseup', e => {
      off()
    }, { once: true })

    moveToTarget(e)
    // log('click', x, y)
  }))

  const c = canvas.getContext('2d', { alpha: false })!
  const hc = handle.getContext('2d', { alpha: true })!
  const matrix = new Matrix()
  $.fx(() => {
    const { info } = grid
    const { boxes } = info
    const { pr } = view
    $()
    Matrix.viewBox(matrix, view, {
      x: 0,
      y: 0,
      w: boxes.right / view.pr,
      h: boxes.rows.length / view.pr + .08,
    })
    c.save()
    c.scale(pr, pr)
    view.clear(c)
    c.setTransform(matrix)
    for (const row of boxes.rows) {
      c.beginPath()
      let color
      for (const box of row) {
        const [, x, y, w, h, , , , boxColor] = box
        color = boxColor
        c.rect(x, y + .15, w, h - .2)
      }
      c.fillStyle = '#' + (color ?? 0x0).toString(16).padStart(6, '0')
      c.fill()
    }
    c.restore()
  })

  $.fx(() => {
    const { a, b, c: mc, d, e, f } = grid.intentMatrix
    const { w: vw, h: vh } = grid.view
    const { pr } = handleView
    $()
    const c = hc
    c.save()
    c.scale(pr, pr)
    handleView.clear(c)
    c.translate(.5, .5)
    c.beginPath()
    const x = -(e / a / pr) * matrix.a
    const y = -(f / d / pr) * matrix.d
    const w = (vw / a / pr) * matrix.a
    const h = (vh / d / pr) * matrix.d
    // c.rect(x, y, w, h - .5)
    c.moveTo(x, y + h)
    c.lineTo(x, y)
    c.lineTo(x + w, y) //, w, h - .5)
    c.fillStyle = '#fff3'
    c.fill()
    c.strokeStyle = '#fffa'
    c.lineWidth = 2.1
    c.stroke()


    c.beginPath()
    c.moveTo(x + w, y)
    c.lineTo(x + w, y + h)
    c.lineTo(x, y + h)
    c.fillStyle = '#fff3'
    c.fill()

    c.strokeStyle = '#000c' //state.colors['primary'] + '55'
    c.lineWidth = 2.1
    c.stroke()

    c.restore()
  })

  return { canvas, handle }
}
