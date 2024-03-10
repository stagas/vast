import { $ } from 'signal-jsx'
import { Audio } from './audio.ts'

class Services {
  get audio() { $(); return Audio() }
}

export const services = $(new Services)
