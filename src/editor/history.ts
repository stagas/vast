import { $, fn, fx, of } from 'signal'
import { Line, Point } from 'std'
import { debounce, deepMerge } from 'utils'
import { Comp } from './comp.ts'

export interface Snapshot {
  code: string
  coli: number
  linecol: Point['json']
  scroll: Point['json']
  selection: Line['json']
}

export interface EditorViewState {
  coli: number
  linecol: Point
  scroll: Point
  historyIndex: number
  history: Snapshot[]
}

export class History extends Comp {
  static createViewState(): EditorViewState {
    return {
      coli: 0,
      linecol: $(new Point),
      scroll: $(new Point),
      historyIndex: 0,
      history: []
    }
  }
  viewState: EditorViewState = History.createViewState()
  prevViewState?: EditorViewState

  @fx update_prevViewState() {
    const { viewState } = this
    $()
    queueMicrotask(() => {
      this.prevViewState = viewState
    })
  }
  @fn saveHistoryMeta() {
    const { ctx, viewState: vs } = this
    if (this.prevViewState !== vs) return
    const { buffer, dims, selection } = of(ctx)
    const { coli, linecol } = of(buffer)
    const { scroll } = of(dims)

    const snapshot: Omit<Snapshot, 'code'> = {
      coli,
      linecol: linecol.json,
      scroll: scroll.json,
      selection: selection.json,
    }

    const current = vs.history[vs.historyIndex]

    if (linecol.line === (current?.linecol.y ?? -1)
      && Math.abs(linecol.col - (current?.linecol.x ?? 0)) < 2
      && buffer.code === current?.code) {
      deepMerge(current, snapshot)
      return
    }
    return snapshot
  }

  @fn saveHistory() {
    const { ctx, viewState: vs } = this
    const { buffer } = of(ctx)
    const { code } = of(buffer)

    if (vs.historyIndex < vs.history.length - 1 && code === vs.history[vs.historyIndex].code) return

    let partialSnapshot = this.saveHistoryMeta()
    if (!partialSnapshot) return

    const snapshot: Snapshot = Object.assign(partialSnapshot, { code })

    if (vs.historyIndex < vs.history.length - 1) {
      vs.history = vs.history.slice(0, vs.historyIndex + 1)
    }
    vs.historyIndex = vs.history.push(snapshot) - 1
  }

  saveHistoryDebounced = debounce(300, () => this.saveHistory(), { first: true, last: true })

  historic<T extends (...args: any[]) => any>(fn: T): T & { sansHistory: T } {
    const self = this
    return Object.assign($.fn(function (this: any, ...args: any[]) {
      try {
        self.saveHistory()
        return fn.apply(this, args)
      }
      catch (error) {
        console.error(fn.toString())
        throw error
      }
      finally {
        self.saveHistory()
      }
    }) as T, {
      sansHistory: fn
    })
  }

  @fn applySnap(snap: Snapshot) {
    const { ctx, viewState: vs } = this
    const { buffer, scroll, selection } = of(ctx)

    const copy = JSON.parse(JSON.stringify(snap)) as Snapshot
    buffer.code = snap.code
    // KEEP: flush code effects (split lines etc.)
    // before applying rest of snap.
    $.flush()
    buffer.coli = copy.coli
    buffer.linecol.set(copy.linecol)
    scroll.targetScroll.set(copy.scroll)
    selection.set(copy.selection)
  }

  undo = this.historic(() => {
    const vs = this.viewState
    if (vs.historyIndex > 0) {
      const snap = vs.history[--vs.historyIndex]
      // log.pretty('undo', snap)
      this.applySnap(snap)
    }
  })

  redo = this.historic(() => {
    const vs = this.viewState
    if (vs.historyIndex < vs.history.length - 1) {
      const snap = vs.history[++vs.historyIndex]
      // log.pretty('redo', snap)
      this.applySnap(snap)
    }
  })
}
