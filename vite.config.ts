/// <reference types="vitest" />
import fs from 'fs'
import openInEditor from 'open-in-editor'
import os from 'os'
import path from 'path'
import { defineConfig } from 'vite'
import externalize from "vite-plugin-externalize-dependencies"
import ViteUsing from 'vite-plugin-using'
import { watchAndRun } from 'vite-plugin-watch-and-run'
import tsconfigPaths from 'vite-tsconfig-paths'
import assemblyScriptPlugin from "./vendor/vite-plugin-assemblyscript"

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
    target: 'es2022',
    include: /\.(m?[jt]s|[jt]sx)$/,
    exclude: []
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      treeshake: { propertyReadSideEffects: 'always' },
    }
  },
  plugins: [
    ViteUsing(),
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
      srcEntryFile: 'as/assembly/index.ts'
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
