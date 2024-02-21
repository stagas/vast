import { state } from '../state.ts'

export async function svgToImg(svg: string, color: string) {
  const markup = svg.trim().replaceAll('currentColor', color)
  const img = new Image()
  await new Promise(resolve => {
    img.onload = resolve
    img.src = 'data:image/svg+xml,' + encodeURIComponent(markup)
  })
  return img
}

export async function fromSvg(svg: string) {
  const img = await svgToImg(svg, state.colors['base-content'])
  const img_hover = await svgToImg(svg, state.colors['base-content'])
  return { img, img_hover }
}
