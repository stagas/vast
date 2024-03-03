/// <reference types="vitest" />
import fs from 'fs'
import openInEditor from 'open-in-editor'
import os from 'os'
import path from 'path'
import { defineConfig, transformWithEsbuild } from 'vite'
import externalize from "vite-plugin-externalize-dependencies"
import { watchAndRun } from 'vite-plugin-watch-and-run'
import tsconfigPaths from 'vite-tsconfig-paths'
import assemblyScriptPlugin from './vendor/vite-plugin-assemblyscript'
import ViteUsing from './vendor/vite-plugin-using'
import bundledEntryPlugin from './vendor/vite-plugin-bundled-entry'

import type { HmrContext, Plugin } from 'vite'

interface DebounceOptions {
  first?: boolean
  last?: boolean
}
export function debounce<T extends (...args: any[]) => any>(ms: number, fn: T, options?: DebounceOptions): T {
  let resolving = false

  let timeToResolve: number
  let now: number
  let delta: number
  let callThis: any
  let callArgs: any

  function resolver() {
    now = performance.now()
    delta = timeToResolve - now
    if (delta > 5) {
      setTimeout(resolver, delta)
    }
    else if (callArgs) {
      fn.apply(callThis, callArgs)
      resolving = false
    }
  }

  function wrapper(this: any, ...args: any[]) {
    callThis = this
    callArgs = args
    timeToResolve = performance.now() + ms
    if (resolving) return
    if (options?.first) {
      fn.apply(callThis, callArgs)
      if (!options.last) {
        callArgs = void 0
      }
    }
    resolving = true
    setTimeout(resolver, ms)
  }

  return wrapper as T
}

function PrintUrlsPlugin(): Plugin {
  let hmrContext: HmrContext
  return {
    name: 'vite-plugin-print-urls',
    enforce: 'pre',
    handleHotUpdate(ctx) {
      hmrContext = ctx
    },
    configureServer({ watcher, printUrls, config }) {
      printUrls = debounce(2000, printUrls)

      watcher.on('all', (_, file) => {
        printUrls()

        const queue = config.plugins.map(plugin => (plugin.handleHotUpdate && hmrContext
          ? (plugin.handleHotUpdate as any)(hmrContext)
          : Promise.resolve()))

        Promise.all(queue).then((fullModules) => {
          const filteredModules = fullModules.filter((item) => item && item.length)

          if (filteredModules.length || hmrContext?.modules.length) {
            // hmr update
            config.logger.info('')
            printUrls()
          }

          if (!hmrContext?.modules.length) {
            if (file.endsWith('.html')) {
              // page reload
              config.logger.info('')
              printUrls()
            }
          }
        })
      })
    }
  }
}

const hexLoader: Plugin = {
  name: 'hex-loader',
  transform(code, id) {
    const [path, query] = id.split('?')
    if (query != 'raw-hex')
      return null

    const data = fs.readFileSync(path)
    const hex = data.toString('hex')

    return `export default '${hex}';`
  }
}

// const fileRegex = /worklet/gi

// const workletPlugin: Plugin = {
//   name: 'worklet',

//   async transform(code, id) {
//     if (fileRegex.test(id)) {
//       const result = await build({
//         entryPoints: [id],
//         bundle: true,
//         plugins: [
//           {
//             name: 'hex-loader',
//             setup(build) {
//               build.onLoad({ filter: /\?raw-hex$/ }, (args) => {
//                 const result = hexLoader.transform(code, args.path) ?? ''
//                 return {
//                   contents: result,
//                   loader: 'js'
//                 }
//               })
//             }
//           },
//           {
//             name: 'url-loader',
//             setup(build) {
//               build.onLoad({ filter: /\?url$/ }, (args) => {
//                 return {
//                   contents: `export default "${path.relative(process.cwd(), args.path)}"`,
//                   loader: 'js'
//                 }
//               })
//             }
//           },
//         ]
//       })
//       const out = result.outputFiles?.[0].text
//       console.log(out)
//       return {
//         code: out,
//         map: null, // provide source map if available
//       }
//     }
//   }
// }

const editor = openInEditor.configure({
  editor: 'code',
  dotfiles: 'allow',
})!

const homedir = os.homedir()

const IS_TEST = process.env.NODE_ENV === 'test'

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
  test: {
    globals: true,
    environment: 'jsdom',
    includeSource: ['src/**/*.{js,jsx,ts,tsx}'],
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
  server: {
    host: 'devito.test',
    fs: {
      allow: [
        '/',
      ]
    },
    https: {
      key: fs.readFileSync(path.join(homedir, '.ssl-certs', 'devito.test-key.pem')),
      cert: fs.readFileSync(path.join(homedir, '.ssl-certs', 'devito.test.pem')),
    }
  },
  esbuild: {
    jsx: 'automatic',
    // target: 'esnext',
    // include: /\.(m?[jt]s|[jt]sx)$/,
    // exclude: ['**/assembly/dsp/**/*']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      treeshake: { propertyReadSideEffects: 'always' },
    }
  },
  plugins: [
    {
      name: 'coop-coep',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
          next()
        })
      },
    },
    ViteUsing(),
    // bundledEntryPlugin({
    //   id: '/player-worklet.js',
    //   outFile: '/assets/player-worklet.[hash].js',
    //   entryPoint: 'src/dsp/player-worklet.ts',
    //   esbuildOptions: {
    //     // (optional) esbuild options to use for bundling
    //     // minify: process.env.NODE_ENV === 'production',
    //     format: 'iife', // default "esm"
    //   },
    //   // transform(code) {
    //   //   // (optional) transform to apply on generated bundle
    //   // }
    // }),
    hexLoader,
    tsconfigPaths(),
    externalize({
      externals: [
        'node:fs/promises',
        (moduleName) => moduleName.startsWith('node:')
      ],
    }),
    // !IS_TEST && nodePolyfills({
    //   exclude: ['fs']
    // }),
    assemblyScriptPlugin({
      projectRoot: '.',
      srcMatch: 'as/assembly',
      srcEntryFile: 'as/assembly/index.ts',
      extra: [
        '--transform', './vendor/unroll.js',
        '--transform', './vendor/update-dsp-gens.js',
      ]
    }),
    // assemblyScriptPlugin({
    //   configFile: 'asconfig-nort.json',
    //   projectRoot: '.',
    //   srcMatch: 'as/assembly',
    //   srcEntryFile: 'as/assembly/index.ts',
    //   extra: [
    //     '--transform', './vendor/unroll.js',
    //     '--transform', './vendor/update-dsp-gens.js',
    //   ]
    // }),
    assemblyScriptPlugin({
      configFile: 'asconfig-player.json',
      projectRoot: '.',
      srcMatch: 'as/assembly',
      srcEntryFile: 'as/assembly/seq/player.ts',
      mapFile: './as/build/player.wasm.map',
      extra: [
        '--transform', './vendor/unroll.js',
      ]
    }),
    assemblyScriptPlugin({
      configFile: 'asconfig-player-nort.json',
      projectRoot: '.',
      srcMatch: 'as/assembly',
      srcEntryFile: 'as/assembly/seq/player.ts',
      mapFile: './as/build/player-nort.wasm.map',
      extra: [
        '--transform', './vendor/unroll.js',
      ]
    }),
    !IS_TEST && {
      name: 'open-in-editor',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.method === 'POST') {
            const fsPath = req.url!.slice(1).replace('@fs', '')
            const homedir = os.homedir()
            console.log(fsPath, homedir)
            let filename: string
            if (fsPath.startsWith(homedir)) {
              filename = fsPath
            }
            else {
              filename = path.join(process.cwd(), fsPath)
            }
            try {
              await editor.open(filename)
            }
            catch (error) {
              res.writeHead(500)
              res.end((error as Error).message)
              return
            }
            res.writeHead(200, {
              'content-type': 'text/html'
            })
            res.end('<script>window.close()</script>')
            return
          }
          next()
        })
      },
    },
    !IS_TEST && PrintUrlsPlugin(),
    watchAndRun([
      {
        name: 'scripts',
        watchKind: ['add', 'change', 'unlink'],
        watch: path.resolve('scripts/**.ts'),
        run: 'npm run scripts',
        delay: 100
      }
    ])
  ],
})
