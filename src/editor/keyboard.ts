import { $, fn, fx, of, when } from 'signal'
import { Point, Rect } from 'std'
import { dom, isMobile, maybeSpliceFind, on } from 'utils'
// import { Keyboardable } from './keyboardable.ts'
// import { Rect } from './rect.ts'
// import { World } from './world.ts'

export class Keyboard {
  // constructor(public textarea: HTMLTextAreaElement) { }

  // focusIt?: any //Keyboardable.It | null
  isFocused = false

  real?: KeyboardEvent
  clip?: ClipboardEvent
  pasted = ''
  keys: Keyboard.Key[] = []
  key?: Keyboard.Key | undefined
  char = ''
  special: (
    Keyboard.Key & {
      kind: Keyboard.KeyKind.Special
    })['value'] | '' = ''
  alt?: boolean | undefined
  ctrl?: boolean | undefined
  shift?: boolean | undefined
  time: number = 0

  style?: CSSStyleDeclaration

  public onKeyboardEvent?(kind: Keyboard.EventKind): Keyboard.Result

  appendTo(el: HTMLElement) {
    el.append(this.textarea)
    this.style = this.textarea.style
    return this
  }
  @fx init_listeners() {
    const { textarea: t } = this
    return [
      on(t, 'contextmenu', dom.prevent.stop),
      isMobile() ? on(t as any, 'input', this.handleKey) : () => {},
      on(t, 'keydown', this.handleKey),
      on(t, 'keyup', this.handleKey),
      on(t, 'copy', this.handleClip(Keyboard.EventKind.Copy)),
      on(t, 'cut', this.handleClip(Keyboard.EventKind.Cut)),
      on(t, 'paste', this.handleClip(Keyboard.EventKind.Paste)),
      on(t, 'blur', () => { this.isFocused = false }),
      on(t, 'focus', () => { this.isFocused = true }),
    ]
  }
  pointerPos?: Point
  @fx textarea_follows_mouse() {
    const { style, pointerPos: pos } = of(this)
    const { x, y } = pos
    $()
    this.textareaRect.center.set(pos)
  }
  @fx move_textarea() {
    const { style } = of(this)
    style.transform =
      this.textareaRect.pos.styleTransformTranslate
  }


  // @fx update_focusIt() {
  //   const { style, world } = of(this)
  //   const { mouse } = of(world)
  //   const { downIt } = when(mouse)
  //   $()
  //   if (downIt.keyboardable) {
  //     this.focusIt = downIt as Keyboardable.It
  //   }
  // }
  // @fx update_isFocused() {
  //   const { focusIt: { keyboardable: k } } = of(this)
  //   $()
  //   k.isFocused = true
  //   return () => {
  //     k.isFocused = false
  //   }
  // }
  kind?: Keyboard.EventKind
  @fn handleKey =
    (e: KeyboardEvent) => {
      const { keys, textarea } = this
      const real = e
      if (real.key === 'Unidentified') return

      const realType = real.type === 'input' ? 'keydown' : real.type

      const time = real.timeStamp

      let kind: Keyboard.EventKind = EventMap[realType]
      if (kind == null) {
        throw new TypeError('Not implemented keyboard event: ' + realType)
        return
      }

      const { Down, Up } = Keyboard.EventKind

      const realKey = !real.key || (real.key === 'Unidentified')
        ? textarea.value.slice(-1)
        : real.key

      let key: Keyboard.Key | undefined
      let char = ''
      let special = ''

      switch (kind) {
        case Down:
          if (realKey.length === 1) {
            key = {
              kind: Keyboard.KeyKind.Char,
              value: char = realKey,
              real,
              time
            }
          }
          else {
            key = {
              kind: Keyboard.KeyKind.Special,
              value: special = realKey as any,
              real,
              time
            }
          }
          break

        case Up:
          key = maybeSpliceFind(
            keys,
            key => key.value === realKey
          )
          break
      }

      if (real.key && key && kind === Down) {
        keys.push(key)
      }

      this.kind = kind
      this.real = real
      this.time = time
      this.key = key
      this.char = char
      this.special = special as any
      this.alt = real.altKey || void 0
      this.ctrl = (real.ctrlKey || real.metaKey) || void 0
      this.shift = real.shiftKey || void 0

      if (this.onKeyboardEvent?.(kind)) {
        dom.prevent(real)
      }
    }
  @fn handleClip =
    (kind: Keyboard.EventKind) =>
      (e: ClipboardEvent) => {
        this.clip = e

        if (kind === Keyboard.EventKind.Paste) {
          this.pasted = e.clipboardData?.getData('text') ?? ''
        }

        const res = this.onKeyboardEvent?.(kind)

        if (res != null) {
          if (typeof res === 'string') {
            this.textarea.value = res
            this.textarea.select()
          }
          else {
            dom.prevent(e)
          }
        }
      }
  textareaRect = $(new Rect, { w: 50, h: 50 })
  textarea: HTMLTextAreaElement = dom.el('textarea', {
    spellcheck: false,
    autocorrect: 'off',
    virtualkeyboardpolicy: 'manual',
    style: {
      cssText: /*css*/`
      position: fixed;
      opacity: 0;
      top: 0px;
      left: 0px;
      width: 50px;
      height: 50px;
      /* pointer-events: none; */
      caret-color: transparent;
      border: none;
      resize: none;
      padding: 0;
      outline: none;
      white-space: pre;
      overflow: hidden;
      z-index: 999999;
      `
    }
  })
}

export namespace Keyboard {
  export type Result = string | true | void | undefined
  export enum EventKind {
    Down,
    Up,
    Copy,
    Cut,
    Paste,
  }
  export enum KeyKind {
    Char,
    Special,
  }
  export type Key = {
    real: KeyboardEvent
    time: number
  } & ({
    kind: KeyKind.Char
    value: string
  } | {
    kind: KeyKind.Special
    value:
    | 'Control'
    | 'Shift'
    | 'Alt'
    | 'Enter'
    | 'Tab'
    | 'Space'
    | 'Backspace'
    | 'Delete'
    | 'Home'
    | 'End'
    | 'PageUp'
    | 'PageDown'
    | 'ArrowLeft'
    | 'ArrowUp'
    | 'ArrowRight'
    | 'ArrowDown'
  })
}

const EventMap: Record<string, Keyboard.EventKind> = {
  keydown: Keyboard.EventKind.Down,
  keyup: Keyboard.EventKind.Up,
}
