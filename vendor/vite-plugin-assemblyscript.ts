// https://github.com/ed-25519/vite-plugin-assemblyscript-asc/blob/main/src/index.ts
import asc from 'assemblyscript/dist/asc'
import fs from 'fs'
import { join, resolve, sep } from 'path'
import type { Plugin } from 'vite'

interface AssemblyScriptPluginOptions {
  projectRoot: string
  srcMatch: string
  srcEntryFile: string
}

const defaultOptions: AssemblyScriptPluginOptions = {
  projectRoot: '.',
  srcMatch: 'as/assembly',
  srcEntryFile: 'as/assembly/index.ts',
}

async function compile(entryFile: string, mode: 'debug' | 'release') {
  console.log('[asc] compiling...')

  const { error, stdout, stderr, stats } = await asc.main([
    entryFile,
    '--target', mode,
    '--transform', './vendor/unroll.js',
    '--transform', './vendor/update-dsp-gens.js',
  ], {})

  if (error) {
    console.log('Compilation failed: ' + error.message)
    console.log(stdout.toString())
    console.log(stderr.toString())
  }
  else {
    console.log(stdout.toString())
    console.log(stats.toString())
    const mapFile = join(__dirname, '..', 'as', 'build', 'assembly.wasm.map')
    const mapJson = fs.readFileSync(mapFile, 'utf-8')
    const map = JSON.parse(mapJson)

    // This is the magic that makes paths work for open-in-editor from devtools console.
    // TODO: should be made configurable.
    map.sourceRoot = '/'

    fs.writeFileSync(mapFile, JSON.stringify(map), 'utf-8')
  }
}

export default function assemblyScriptPlugin(
  userOptions: Partial<AssemblyScriptPluginOptions> = defaultOptions
): Plugin {
  const options = {
    ...defaultOptions,
    ...userOptions,
  }

  const entryFile = join(options.projectRoot, options.srcEntryFile)
  const matchPath = resolve(join(options.projectRoot, options.srcMatch))

  let handledTimestamp: any

  return {
    name: 'vite-plugin-assemblyscript-asc',
    async handleHotUpdate({ file, timestamp }) {
      if (file.startsWith(matchPath)) {
        if (timestamp === handledTimestamp) return
        handledTimestamp = timestamp
        await compile(entryFile, 'debug')
      }
    },
    async buildStart() {
      await compile(entryFile, 'release')
    },
  }
}
