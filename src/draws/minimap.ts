import { Signal } from 'signal-jsx'
import { Matrix, Rect } from 'std'
import { dom } from 'utils'
import { Canvas } from '../comp/Canvas.tsx'
import { log, state } from '../state.ts'
import { Grid } from './grid.ts'
import { CODE_WIDTH } from '../constants.ts'
import { toHex } from '../util/rgb.ts'

const DEBUG = true

export type Minimap = ReturnType<typeof Minimap>

export function Minimap(grid: Grid) {
  using $ = Signal()

  const view = $(new Rect, { w: 250, h: 34, pr: state.$.pr })
  const handleView = $(new Rect, { w: 260, h: 42, pr: state.$.pr })

  const canvas = Canvas({ view })
  const handle = Canvas({ view: handleView })
  handle.style.position = 'absolute'
  handle.style.left = '-5px'
  handle.style.top = '-4px'
  canvas.style.marginBottom = '-1px'

  $.fx(() => dom.on(handle, 'wheel', e => {
    const m = grid.intentMatrix
    grid.mousePos.x = ((state.mode === 'wide' ? 0 : CODE_WIDTH + 55) - m.e) / m.a
    grid.mousePos.y = 0
    grid.handleWheelScaleX(e)
    DEBUG && log('wheel', grid.mousePos.x, grid.mousePos.y)
  }, { passive: true }))

  $.fx(() => dom.on(handle, 'mousedown', e => {
    const rect = handle.getBoundingClientRect()

    function moveToTarget(e: MouseEvent) {
      const m = grid.intentMatrix
      const l = grid.lastFarMatrix
      const boxes = grid.info.boxes
      if (!boxes) return

      const x = (e.pageX - rect.left) / view.w
      const y = (e.pageY - rect.top) / view.h

      const { left, width } = boxes.info

      m.e = -x * width * m.a + (grid.view.w + CODE_WIDTH + 55) / 2 - left * m.a
      l.e = -x * width * l.a + grid.view.w / 2 - left * l.a
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
  }))

  const c = canvas.getContext('2d', { alpha: true })!
  const hc = handle.getContext('2d', { alpha: true })!
  const matrix = new Matrix()
  $.fx(() => {
    const { info } = grid
    const { boxes } = $.of(info)
    const { left, width, rows } = boxes.info
    const { colors } = state
    const { pr } = view
    $()
    Matrix.viewBox(matrix, view, {
      x: left,
      y: 0,
      w: width / view.pr,
      h: rows.length / view.pr - (1 / view.h),
    })
    c.save()
    c.scale(pr, pr)
    view.clear(c)
    // view.fill(c, toHex(colors['base-100']))
    c.setTransform(matrix)
    for (const row of boxes.info.rows) {
      c.beginPath()
      let color
      for (const { rect, trackBox } of row) {
        const { x, y, w, h } = rect
        color = trackBox.track.info.color
        c.rect(x, y + 10 * (1 / view.h), w, h - 20 * (1 / view.h))
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
    const { info } = grid
    const { boxes } = $.of(info)
    const { left } = boxes.info
    const { colors } = state

    $()
    const c = hc

    c.save()
    c.scale(pr, pr)
    handleView.clear(c)
    c.translate(.5, 2.5)

    const padX = state.mode === 'wide' ? 0 : CODE_WIDTH + 55.5
    const x = -((e - padX + left * a) / a / pr) * matrix.a + 2
    const y = -((f) / d / pr) * matrix.d
    const w = ((vw - padX - 5) / a / pr) * matrix.a + 9
    const h = (vh / d / pr) * matrix.d + 2

    c.beginPath()
    c.rect(x, y, w, h)
    // c.moveTo(x + w, y)
    // c.lineTo(x + w, y + h)
    // c.lineTo(x, y + h)
    const color = toHex(colors['base-content'])
    c.fillStyle = color + '22'
    c.fill()
    // c.strokeStyle = color
    // c.lineWidth = 2.1
    // c.stroke()

    // c.beginPath()
    // c.moveTo(x, y + h)
    // c.lineTo(x, y)
    // // c.lineTo(x + w, y)
    // c.fillStyle = '#fff1'
    // c.fill()
    // c.strokeStyle = '#fff'
    // c.lineWidth = 2.1
    // c.stroke()


    c.restore()
  })

  return { canvas, handle }
}
