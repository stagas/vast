import { createHash } from 'crypto'
import { BuildContext, BuildOptions, BuildResult, context } from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import type { PluginContext } from 'rollup'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'

const PRE = ''

export interface BundledEntryPluginOptions {
  id: string
  outFile: string
  entryPoint: string
  esbuildOptions?: BuildOptions
  transform?(code: string): string
}

export default function bundledEntryPlugin(
  opts: BundledEntryPluginOptions
): Plugin {
  let config: ResolvedConfig
  let isBuild: boolean
  let server: ViteDevServer
  let result: BuildResult | undefined
  let ctx: BuildContext
  let esbuildOptions: BuildOptions

  const watchedFiles = new Set<string>()
  const watchers: fs.FSWatcher[] = []

  async function generate(c: PluginContext) {
    const initial = !result

    if (initial) {
      ctx = await context(esbuildOptions)

      if (!isBuild) {
        const onChange = (changedFile: string) => {
          if (watchedFiles.has(changedFile)) {
            const mods = server.moduleGraph.getModulesByFile(opts.id)
            if (mods) {
              mods.forEach(m => server.moduleGraph.invalidateModule(m))
            }
            server.ws.send({
              type: 'full-reload',
              path: '*',
            })
          }
        }
        server.watcher.on('add', onChange)
        server.watcher.on('change', onChange)
        server.watcher.on('unlink', onChange)
      }
    }

    result = await ctx.rebuild()

    for (const file in result.metafile?.inputs) {
      const resolved = path.resolve(config.root, file)
      if (fs.existsSync(resolved)) {
        watchedFiles.add(resolved)
        server?.watcher?.add(resolved)
      }
    }

    const { text: code } = result.outputFiles?.find((it) =>
      it.path.endsWith(esbuildOptions.outfile || '<stdout>')
    )!

    const sourcemap = result.outputFiles?.find((it) =>
      it.path.endsWith('.map')
    )

    return {
      code,
      map: sourcemap?.text,
    }
  }

  let emitter: Promise<string> | undefined

  function emit(context: PluginContext) {
    if (!emitter) {
      emitter = generate(context).then(({ code }) => {
        const contentHash = getAssetHash(Buffer.from(code))
        const url = opts.outFile.replace(/\[hash\]/, contentHash)
        context.emitFile({
          id: '.' + opts.id,
          fileName: url.slice(1),
          type: 'chunk',
        })
        return url
      })
    }
    return emitter
  }

  async function getUrl(context: PluginContext) {
    if (isBuild) {
      return await emit(context)
    } else {
      return opts.outFile
    }
  }

  return {
    name: `vite:plugin:bundled:entry:${opts.id}`,
    configResolved(c) {
      config = c

      isBuild = config.command === 'build'
console.log('is build', isBuild)
      const isBuildWatch = !!config.build.watch

      esbuildOptions = {
        absWorkingDir: config.root,
        entryPoints: [opts.entryPoint],
        format: 'iife',
        outfile: `bundle_${opts.id.replace(/[^a-zA-Z_]+/g, '_')}`,
        sourcemap: isBuild ? false : 'external',
        ...opts.esbuildOptions,
        define: {
          ...config.define,
          ...(opts.esbuildOptions?.define || {}),
        },
        bundle: true,
        write: false,
        metafile: !isBuild || isBuildWatch,
        loader: {
          '.wasm': 'binary',
        },
      }
    },
    configureServer(s) {
      server = s
    },
    async resolveId(id, importer) {
      if (id.startsWith(opts.id)) {
        return id
      }
      if (id.startsWith(opts.outFile)) {
        if (isBuild) {
          return {
            id: (await emit(this)).slice(1),
            external: true,
          }
        } else {
          return opts.id
        }
      }
    },
    async buildStart() {
      // ensures our entry gets emitted no matter what
      if (isBuild) await emit(this)
    },
    async transform(code, id) {
      if (
        id.startsWith(opts.id) &&
        !isBuild &&
        !id.includes('?url') &&
        !id.includes('?rawbundle') &&
        opts.transform
      ) {
        return opts.transform(code)
      }
    },
    async load(id) {
      console.log('loading', id, opts.id)
      if (id.startsWith(opts.id)) {
        if (id.includes('?url'))
          return `export default '${await getUrl(this)}'`
        if (id.includes('?rawbundle'))
          return `export default ${JSON.stringify((await generate(this)).code)}`
        // in build mode, will be renderer in renderChunk
        return isBuild ? '' : await generate(this)
      }
    },
    renderChunk(code, { facadeModuleId }) {
      // during build mode, generate chunk at render time to avoid re-processing the esbuild output through rollup
      if (facadeModuleId === opts.id) {
        return generate(this)
      }
      return null
    },
    async closeBundle() {
      ctx?.dispose()
      result = undefined
      emitter = undefined
    },
  }
}

function getAssetHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}
