import { Engine } from '../../as/assembly/dsp/core/engine'
import { Gen } from '../../as/assembly/dsp/gen/gen'
export const Factory: ((engine: Engine) => Gen)[] = []
export const Offsets: usize[][] = []
