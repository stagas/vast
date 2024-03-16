import { Signal, storage } from 'signal-jsx'
import { screen } from './screen.tsx'
import { HEADER_HEIGHT } from './constants.ts'

export function Layout() {
  using $ = Signal()
  const info = $({
    mainY: storage(window.innerHeight / 100 * 60),
    get mainYBottom() { return this.mainY + HEADER_HEIGHT / 2 + 2 },
    codeWidth: window.innerWidth / 2, //storage(window.innerWidth / 2),
    get codeHeight() { return screen.info.rect.h - (this.mainY + HEADER_HEIGHT / 2) - 2 },
    get previewWidth() { return screen.info.rect.w - this.codeWidth - 2 },
  })
  return { info }
}

export const layout = Layout()
