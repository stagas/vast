import fs from 'fs'
import { basename, join } from 'path'

const template_assembly = fs.readFileSync('./assembly/ops/vm/template.ts', 'utf-8')
const template_typescript = fs.readFileSync('./src/vm/template.ts', 'utf-8')
const root = './as/assembly/dsp/'
const dspFile = 'dsp.ts'
// const files = fs.readdirSync(root).sort()

const numericTypes = new Set('usize i32 u32 f32 f64'.split(' '))

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

const parseFuncsRegExp = /(?<fn>[a-z]+)\((?<args>.*)\)(?::.*?){/g
const drawRegExp = /draw\((?<args>.*)\)/

const imports: string[] = [
  `import { Op } from './op'`,
  `import { Canvas } from '../../../assembly/gfx/canvas'`
]
const locals: string[] = []
const pools: string[] = []
const enums: string[] = [`  End`, `  Begin`]
const ops: string[] = []
const begins: string[] = []
const funcs: string[] = []

locals.push(`let pool_index: i32 = 0`)

// for (const file of files) {
const file = dspFile
const base = basename(file, '.ts')
const filename = join(root, file)
const text = fs.readFileSync(filename, 'utf-8')
const fns = [...text.matchAll(parseFuncsRegExp)].map(m => ({
  fn: m.groups!.fn,
  args: m.groups!.args
    .split(', ')
    .map(x => x.split(': ')) as [name: string, type: string][]
}))

const ctor = capitalize(base)
imports.push(`import { ${ctor} } from '../../.${root}/${base}'`)

const basePool = `this.${base}_pool`
const baseInstance = `${base}_instance`

pools.push(`  ${base}_pool: ${ctor}[] = []`)

locals.push(`    let ${base}_pool_index: i32 = 0`)
locals.push(`    let ${baseInstance}: ${ctor}`)

enums.push(`  ${ctor}_create`)
fns.forEach(({ fn }) => {
  enums.push(`  ${ctor}_${fn}`)
})

// TODO: create should do a ctor_reset somehow?
ops.push(`
        case Op.${ctor}_create:
          pool_index = ${base}_pool_index++
          if (pool_index >= ${basePool}.length) {
            ${baseInstance} = new ${ctor}()
            ${basePool}.push(${baseInstance})
          }
          break
`)
fns.forEach(({ fn, args }) => {
  ops.push(`
        case Op.${ctor}_${fn}:
          pool_index = ops[i++]
          ${baseInstance} = ${basePool}[pool_index]
          ${baseInstance}.${fn}(${args.map(([, type]) => `
            changetype<${type}>(ops[i++])`
  ).join(', ')}
          )
          break
`)
})

funcs.push(`
  create${ctor}() {
    const count = this.instances.get('${ctor}') ?? 0
    this.instances.set('${ctor}', count + 1)
    this.ops[this.i++] = Op.${ctor}_create
    return {
      ${fns.map(({ fn, args }) => `\
      ${fn}: (${args.map(([name, type]) => `${name}: ${numericTypes.has(type) ? type : 'usize'}`).join(', ')}) => {
        this.ops[this.i++] = Op.${ctor}_${fn}
        this.ops[this.i++] = count
${args.map(([name, type]) => `\
        this.ops${type === 'f32' ? 'f' : ''}[this.i++] = ${name}`).join('\n')}
      }
      `).join(',\n').trim()}
    }
  }
  `)


ops.unshift(`
        case Op.Begin:
${begins.join('\n')}
          break
`)

let targetDir = './generated/assembly/dsp'
fs.mkdirSync(targetDir, { recursive: true })

let targetPath = join(targetDir, 'vm.ts')
{
  let text = imports.join('\n') + '\n'
    + template_assembly
      .replace('// <POOL>', pools.join('\n').trim())
      .replace('// <LOCALS>', locals.join('\n').trim())
      .replace('// <OPS>', ops.join('\n'))
      .replaceAll('Vm', 'DspVm')

  fs.writeFileSync(targetPath, text)
}

//////////

{

  targetPath = join(targetDir, 'op.ts')

  const text = `export enum Op {
${enums.join(',\n')}
}
`

  fs.writeFileSync(targetPath, text)
}

/////////
{
  targetDir = './generated/typescript'
  fs.mkdirSync(targetDir, { recursive: true })

  targetPath = join(targetDir, 'dsp.ts')

  // wasm.vm_GfxVm_constructor
  // wasm.vm_GfxVm_createOps

  const text = `import { Op } from '../assembly/dsp/op.ts'\n` + template_typescript
    .replace('// <SETUP>', `this.vm$ = wasm.vm_DspVm_constructor(0)`)
    .replace('// <CREATE_OPS>', `const ops$ = this.wasm.vm_GfxVm_createOps(this.vm$)
    const ops = this.view.getI32(ops$, MAX_VM_OPS)
    const opsf = this.view.getF32(ops$, MAX_VM_OPS)
    return { ops$, ops, opsf }`)
    .replace('// <RUN>', `this.wasm.vm_GfxVm_run(this.vm$, this.ops$)`)
    .replace('// <FUNCS>', funcs.join('\n').trim())

  fs.writeFileSync(targetPath, text)
}

