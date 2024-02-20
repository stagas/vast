import { Gen, dspGens } from '../generated/typescript/dsp-gens.ts'
import { getAllPropsDetailed } from '../src/dsp/util.ts'
import { capitalize, writeIfNotEqual } from './util.ts'

let out: string[] = []
const offsets: string[] = []
for (const k in dspGens) {
  const props = getAllPropsDetailed(k as keyof Gen)
  out.push(`import { ${capitalize(k)} } from '../../as/assembly/dsp/gen/${k.toLowerCase()}'`)
  offsets.push(`  [${props.map(x => `offsetof<${capitalize(x.ctor)}>('${x.name}')`)}]`)
}

out.push('export const Offsets: usize[][] = [')
out.push(offsets.join(',\n'))
out.push(']')

const targetPath = './generated/assembly/dsp-offsets.ts'
const text = out.join('\n')
writeIfNotEqual(targetPath, text)
