import openInEditor from 'open-in-editor'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import assemblyScriptPlugin from "./vendor/vite-plugin-assemblyscript"
import externalize from "vite-plugin-externalize-dependencies";

import type { HmrContext, Plugin } from 'vite'

function PrintUrlsPlugin(): Plugin {
  let hmrContext: HmrContext
  return {
    name: 'vite-plugin-print-urls',
    enforce: 'pre',
    handleHotUpdate(ctx) {
      hmrContext = ctx
    },
    configureServer({ watcher, printUrls, config }) {
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

const editor = openInEditor.configure({
  editor: 'code',
  dotfiles: 'allow',
})!

const homedir = os.homedir()

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
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
    jsx: 'automatic'
  },
  build: {
    rollupOptions: {
      treeshake: { propertyReadSideEffects: 'always' }
    }
  },
  plugins: [
    externalize({
      externals: [
        'node:fs/promises',
        (moduleName) => moduleName.startsWith('node:')
      ],
    }),
    nodePolyfills({
      exclude: ['fs']
    }),
    assemblyScriptPlugin({
      projectRoot: '.',
      srcMatch: 'src/as/assembly',
      srcEntryFile: 'src/as/assembly/index.ts'
    }),
    {
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
    PrintUrlsPlugin(),
  ],
})
