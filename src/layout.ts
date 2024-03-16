import { Signal, storage } from 'signal-jsx'

export function Layout() {
  using $ = Signal()
  const info = $({
    mainY: storage(window.innerHeight / 100 * 60),
    codeWidth: window.innerWidth / 2, //storage(window.innerWidth / 2),
  })
  return { info }
}

export const layout = Layout()
