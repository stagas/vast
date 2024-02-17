// log.active
import { $, fn, fx, of } from 'signal'
import { PointerLikeEvent, dom, isMobile, on } from 'utils'
import { Point, Rect } from 'std'

export enum PointerEventType {
  Wheel,
  Move,
  Down,
  Up,
  Enter,
  Leave,
  Menu,
}

const EventMap: Record<string, PointerEventType> = {
  wheel: PointerEventType.Wheel,

  contextmenu: PointerEventType.Menu,

  mousedown: PointerEventType.Down,
  mouseup: PointerEventType.Up,
  mousemove: PointerEventType.Move,
  mouseenter: PointerEventType.Enter,
  mouseleave: PointerEventType.Leave,

  touchstart: PointerEventType.Down,
  touchend: PointerEventType.Up,
  touchmove: PointerEventType.Move,
  touchcancel: PointerEventType.Leave,

  pointermove: PointerEventType.Move,
  pointercancel: PointerEventType.Leave,
}

export interface PointerTarget {
  rect: Rect
  handler: () => void
}

export class Pointer {
  constructor() { }

  downCount = 0
  isDown = false

  element?: HTMLElement
  targets = new Set<PointerTarget>()
  hoverTarget?: PointerTarget | null
  focusTarget?: PointerTarget | null
  // add(el: HTMLElement, handler: () => void) {
  //   const { handler: h } = this
  //   const fn = (e: PointerLikeEvent) => {
  //     if (e.type === 'pointerdown' || e.type === 'mousedown') {
  //       this.focusEl = el
  //     }
  //     if (!this.focusEl) {
  //       if (e.type === 'mouseenter' || e.type === 'mousemove') {
  //         this.hoverEl = el
  //       }
  //       else if (e.type === 'mouseleave') {
  //         if (this.hoverEl === el) {
  //           this.hoverEl = null
  //         }
  //       }
  //     }
  //     if (!this.focusEl || (this.focusEl && this.focusEl === el)) {
  //       h(e)
  //       handler()
  //     }
  //   }
  //   this.listeners.set(el, {
  //     handler, listeners: [
  //       on(el, 'wheel', fn, { passive: true }),
  //       on(el, 'mousemove', fn),
  //       on(el, 'mousedown', fn),
  //       on(el, 'mouseenter', fn),
  //       on(el, 'mouseleave', fn),
  //       on(el, 'pointercancel', fn),
  //       on(el, 'contextmenu', fn),
  //     ]
  //   })
  // }
  // remove(el: HTMLElement) {
  //   this.listeners.get(el)?.listeners.forEach(fn => fn())
  //   this.listeners.delete(el)
  // }

  @fx init_listeners(this: Pointer) {
    const { element: el, handler: h } = of(this)
    const mob = isMobile()
    return [
      on(el, 'wheel', h, { passive: true }),
      on(el, 'contextmenu', h),
      on(el, 'pointercancel', h),
      on(el as any, mob ? 'touchstart' : 'mousedown', h),
      on(window as any, mob ? 'touchend' : 'mouseup', h),
      on(window as any, mob ? 'touchmove' : 'mousemove', h),
      // on(window, 'pointermove', h),
      on(document, 'mouseleave', h),
    ]
  }

  /** The latest real DOM event object received from any listener. */
  real?: PointerLikeEvent

  /** Normalized DOM-compatible pointer event. */
  event = $({
    type: 'pointermove',
    pageX: 0,
    pageY: 0,
    deltaX: 0,
    deltaY: 0,
    button: 0,
    buttons: 0,
    altKey: void 0 as true | undefined,
    ctrlKey: void 0 as true | undefined,
    shiftKey: void 0 as true | undefined,
    timeStamp: -999999,
  })

  get type(): PointerEventType {
    return of(EventMap)[this.event.type]
  }

  time = this.event.$.timeStamp

  pos = $(new Point, {
    x: this.event.$.pageX,
    y: this.event.$.pageY
  })

  wheel = $(new Point, {
    x: this.event.$.deltaX,
    y: this.event.$.deltaY
  })

  button = this.event.$.button
  buttons = this.event.$.buttons

  alt = this.event.$.altKey
  ctrl = this.event.$.ctrlKey
  shift = this.event.$.shiftKey

  _sparePoint = $(new Point)

  @fn handler = (real: PointerLikeEvent) => {
    dom.stop(real)

    // if (this.world.anim.isAnimating) {
    // if (real.type === 'mousemove') return
    // }
    // else {
    if (real.type === 'pointermove') return
    // }
    const touch = (
      real.type === 'touchstart'
      || real.type === 'touchend'
      || real.type === 'touchmove'
      || real.type === 'touchcancel'
    ) && real.touches[0]

    this.real = real

    const { event } = this
    const touchToMouse = {
      'touchstart': 'mousedown',
      'touchend': 'mouseup',
      'touchcancel': 'mousecancel',
      'touchmove': 'mousemove',
    }
    event.type = touch ? touchToMouse[real.type] : real.type
    event.pageX = Math.round(touch ? touch.pageX : real.pageX)
    event.pageY = Math.round(touch ? touch.pageY : real.pageY)
    event.altKey = real.altKey || void 0
    event.ctrlKey = (real.ctrlKey || real.metaKey) || void 0
    event.shiftKey = real.shiftKey || void 0
    event.timeStamp = real.timeStamp || performance.now()

    switch (real.type) {
      case 'contextmenu':
        dom.prevent(real)
        break

      case 'wheel':
        event.deltaX = real.deltaX
        event.deltaY = real.deltaY
        break

      case 'touchstart':
      case 'touchend':
      case 'touchmove':
      case 'touchcancel':

      case 'mousemove':
      case 'mousedown':
      case 'mouseup':
      case 'mouseleave':

      // case 'pointermove':
      case 'pointerdown':
      case 'pointerup':

      case 'pointerleave':
      case 'pointercancel':
        event.button = touch ? 1 : 'button' in real ? real.button : 0
        event.buttons = touch ? 1 : 'buttons' in real ? real.buttons : 0
        break
    }

    const p = this._sparePoint
    p.set(this.pos)
    for (const target of this.targets) {
      if (p.withinRect(target.rect)) {
        this.hoverTarget = target
        if (event.type === 'mousedown' || real.type === 'pointerdown') {
          this.focusTarget = target
        }
        target.handler()
        break
      }
    }
    // if (this.focusEl) {
    //   this.listeners.get(this.focusEl)?.handler()
    // }
  }
}
