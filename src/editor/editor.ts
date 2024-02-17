import { $ } from 'signal'
import { Rect } from 'std'
// import { Token } from '../../lang/interpreter.ts'
import { Buffer } from './buffer.ts'
import { Clipboard } from './clipboard.ts'
import { Dims } from './dims.ts'
import { History } from './history.ts'
import { Misc } from './misc.ts'
import { Pointer } from './pointer.ts'
import { Scroll } from './scroll.ts'
import { Selection } from './selection.ts'
import { Text } from './text.ts'
import { Keyboard } from './keyboard.ts'

type Token = { Type: Record<string | number, string | number> }

export class Editor {
  constructor(
    public c: CanvasRenderingContext2D,
    public view: Rect,
    public rect: Rect,
    public Token: Token,
    public keyboard: Keyboard,
    public pointer: Pointer,
  ) { }
  clear() {
    this.view.clear(this.c)
  }

  deco = [] as any[]
  sub = [] as any[]
  markers = [] as any[]

  get buffer(): Buffer {
    $()
    return $(new Buffer(this, this.Token))
  }
  get history(): History {
    $()
    return $(new History(this))
  }
  get scroll(): Scroll {
    $()
    return $(new Scroll(this))
  }
  get dims(): Dims {
    $()
    return $(new Dims(this, this.view, this.rect))
  }
  get selection(): Selection {
    $()
    return $(new Selection(this))
  }
  // get keyboard() {
  //   $()
  //   return $(new Keyboard())
  // }
  get clipboard() {
    $()
    return $(new Clipboard(this))
  }
  get text() {
    $()
    return $(new Text(this))
  }
  get misc() {
    $()
    return $(new Misc())
  }
  // get pointer() {
  //   $()
  //   return $(new Pointer(this.c.canvas))
  // }
}

export function createEditor(
  targetRect: Rect,
  ctx: CanvasRenderingContext2D,
  Token: Token,
  keyboard: Keyboard,
  pointer: Pointer,
) {
  let endBatch = $.batch()

  const rect = $(new Rect()).setParameters(0, 0,
    targetRect.width,
    targetRect.height)

  const view = $(new Rect()).set(targetRect)

  const editor = $(new Editor(ctx, view, rect, Token, keyboard, pointer))

  endBatch()
  return editor
}
