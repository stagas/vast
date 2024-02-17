// log.active
import { $, alias, fx, of } from 'signal'
import { Point } from 'std'
import { clamp } from 'utils'
import { Comp } from './comp.ts'

export class Scroll extends Comp {
  pos = $(new Point)
  x = this.pos.$.x
  y = this.pos.$.y
  scroll = alias(this, 'pos')
  minScroll = $(new Point)
  scrollSize = $(new Point)
  targetScroll = $(new Point)
  animSettings: Scroll.AnimSettings = Scroll.AnimSettings.Fast

  @fx update_innerMatrix_translation() {
    const { misc, dims } = of(this.ctx)
    const { innerMatrix: m } = of(misc)
    const { scroll: { x, y } } = of(dims)
    $()
    const pr = window.devicePixelRatio
    m.e = x * pr
    m.f = y * pr
  }

  @fx update_targetScroll_top() {
    const { history, buffer, dims } = of(this.ctx)
    const { view } = of(dims)
    const { line } = of(buffer)
    const { viewState } = of(history)
    $()
    if (history.prevViewState !== viewState) return

    const { lineTops, lineBottoms, lineHeight, scrollbarSize } = of(dims)
    const { targetScroll } = of(this)

    const viewTop = -targetScroll.top
    const viewBottom = viewTop + view.h + lineHeight

    let y = lineTops[line]!

    let dy: number

    dy = viewTop - y
    if (dy > 0) {
      this.animSettings = Scroll.AnimSettings.Slow
      targetScroll.top += dy
    }
    else {
      if (!(line in lineBottoms)) {
        throw new Error('Invalid line state.')
      }
      y = lineBottoms[line] + lineHeight + scrollbarSize.h + 2
      dy = y - viewBottom
      if (dy > 0) {
        this.animSettings = Scroll.AnimSettings.Slow
        targetScroll.top -= dy
      }
    }
  }

  @fx update_targetScroll_left() {
    const { history, buffer, dims } = of(this.ctx)
    const { view, charWidth } = of(dims)
    const { col } = of(buffer)
    const { viewState } = of(history)
    $()

    if (history.prevViewState !== viewState) return

    const { targetScroll } = of(this)

    const viewLeft = -targetScroll.left
    const viewRight = viewLeft + view.w

    let x = col * charWidth

    let dx: number

    dx = viewLeft - (x - charWidth * 10)
    if (dx > 0) {
      this.animSettings = Scroll.AnimSettings.Slow
      targetScroll.left += dx
    }
    else {
      x += charWidth * 10
      dx = x - viewRight
      if (dx > 0) {
        this.animSettings = Scroll.AnimSettings.Slow
        targetScroll.left -= dx
      }
    }
  }
  @fx update_minScroll() {
    const { ctx, minScroll } = of(this)
    const { dims } = of(ctx)
    const { view, innerSize, lineBottoms, lineHeight, overscrollX } = of(dims)
    const { w, h } = of(innerSize)

    const top = -h
      + Math.min(
        lineBottoms.at(-1) || 0,
        view.h
      )
    const left = -Math.max(0, (w - view.w) + overscrollX)

    $()

    minScroll.top = top
    minScroll.left = left
  }
  // TODO: for best experience we would need a `clampedScroll`
  // that the targetScroll animates to.
  // That will also make the edge bouncy.
  @fx clamp_targetScroll_top() {
    const { targetScroll: { top }, minScroll: { top: minTop } } = this
    $()
    this.targetScroll.top = Math.round(
      clamp(
        minTop,
        0,
        top
      )
    )
  }
  @fx clamp_targetScroll_left() {
    const { targetScroll, minScroll } = this
    targetScroll.left = Math.round(
      clamp(
        minScroll.left,
        0,
        targetScroll.left
      )
    )
  }
  @fx clamp_scroll_top() {
    const { scroll } = this
    scroll.top = Math.min(0, scroll.top)
  }
  @fx clamp_scroll_left() {
    const { scroll } = this
    scroll.left = Math.min(0, scroll.left)
  }
  @fx update_scrollSize() {
    const { ctx, scrollSize } = of(this)
    const { dims } = of(ctx)
    const { innerSize, overscrollX } = of(dims)
    const w = innerSize.w + overscrollX
    const h = innerSize.h
    $()
    scrollSize.w = w
    scrollSize.h = h
  }
}

export namespace Scroll {
  export interface AnimSettings {
    tension: number
    distance: number
    amount: number
    min: number
  }
  export const AnimSettings = {
    "Fast": {
      "tension": 1,
      "distance": 100,
      "amount": 0.5,
      "min": 0.5
    },
    "Medium": {
      "tension": 2.93,
      "distance": 500,
      "amount": 0.6,
      "min": 0.25
    },
    "Slow": {
      "tension": 0.015,
      "distance": 600,
      "amount": 0.29,
      "min": 0.01
    }
  } satisfies Record<string, AnimSettings>
}
