// vite.config.ts
import fs2 from "fs";
import openInEditor from "file:///home/stagas/work/stagas/vast/node_modules/open-in-editor/lib/index.js";
import os from "os";
import path from "path";
import { defineConfig } from "file:///home/stagas/work/stagas/vast/node_modules/vite/dist/node/index.js";
import externalize from "file:///home/stagas/work/stagas/vast/node_modules/vite-plugin-externalize-dependencies/dist/index.js";
import ViteUsing from "file:///home/stagas/work/stagas/vast/node_modules/vite-plugin-using/dist/index.js";
import { watchAndRun } from "file:///home/stagas/work/stagas/vast/node_modules/vite-plugin-watch-and-run/esm/index.js";
import tsconfigPaths from "file:///home/stagas/work/stagas/vast/node_modules/vite-tsconfig-paths/dist/index.mjs";

// vendor/vite-plugin-assemblyscript.ts
import asc from "file:///home/stagas/work/stagas/vast/node_modules/assemblyscript/dist/asc.js";
import fs from "fs";
import { join, resolve } from "path";
var __vite_injected_original_dirname = "/home/stagas/work/stagas/vast/vendor";
var defaultOptions = {
  projectRoot: ".",
  srcMatch: "as/assembly",
  srcEntryFile: "as/assembly/index.ts"
};
async function compile(entryFile, mode) {
  console.log("[asc] compiling...");
  const { error, stdout, stderr, stats } = await asc.main([
    entryFile,
    "--target",
    mode,
    "--transform",
    "./vendor/unroll.js",
    "--transform",
    "./vendor/update-dsp-gens.js"
  ], {});
  if (error) {
    console.log("Compilation failed: " + error.message);
    console.log(stdout.toString());
    console.log(stderr.toString());
  } else {
    console.log(stdout.toString());
    console.log(stats.toString());
    const mapFile = join(__vite_injected_original_dirname, "..", "as", "build", "assembly.wasm.map");
    const mapJson = fs.readFileSync(mapFile, "utf-8");
    const map = JSON.parse(mapJson);
    map.sourceRoot = "/";
    fs.writeFileSync(mapFile, JSON.stringify(map), "utf-8");
  }
}
function assemblyScriptPlugin(userOptions = defaultOptions) {
  const options = {
    ...defaultOptions,
    ...userOptions
  };
  const entryFile = join(options.projectRoot, options.srcEntryFile);
  const matchPath = resolve(join(options.projectRoot, options.srcMatch));
  let handledTimestamp;
  return {
    name: "vite-plugin-assemblyscript-asc",
    async handleHotUpdate({ file, timestamp }) {
      if (file.startsWith(matchPath)) {
        if (timestamp === handledTimestamp)
          return;
        handledTimestamp = timestamp;
        await compile(entryFile, "debug");
      }
    },
    async buildStart() {
      await compile(entryFile, "release");
    }
  };
}

// vite.config.ts
function debounce(ms, fn, options) {
  let resolving = false;
  let timeToResolve;
  let now;
  let delta;
  let callThis;
  let callArgs;
  function resolver() {
    now = performance.now();
    delta = timeToResolve - now;
    if (delta > 5) {
      setTimeout(resolver, delta);
    } else if (callArgs) {
      fn.apply(callThis, callArgs);
      resolving = false;
    }
  }
  function wrapper(...args) {
    callThis = this;
    callArgs = args;
    timeToResolve = performance.now() + ms;
    if (resolving)
      return;
    if (options?.first) {
      fn.apply(callThis, callArgs);
      if (!options.last) {
        callArgs = void 0;
      }
    }
    resolving = true;
    setTimeout(resolver, ms);
  }
  return wrapper;
}
function PrintUrlsPlugin() {
  let hmrContext;
  return {
    name: "vite-plugin-print-urls",
    enforce: "pre",
    handleHotUpdate(ctx) {
      hmrContext = ctx;
    },
    configureServer({ watcher, printUrls, config }) {
      printUrls = debounce(2e3, printUrls);
      watcher.on("all", (_, file) => {
        printUrls();
        const queue = config.plugins.map((plugin) => plugin.handleHotUpdate && hmrContext ? plugin.handleHotUpdate(hmrContext) : Promise.resolve());
        Promise.all(queue).then((fullModules) => {
          const filteredModules = fullModules.filter((item) => item && item.length);
          if (filteredModules.length || hmrContext?.modules.length) {
            config.logger.info("");
            printUrls();
          }
          if (!hmrContext?.modules.length) {
            if (file.endsWith(".html")) {
              config.logger.info("");
              printUrls();
            }
          }
        });
      });
    }
  };
}
var hexLoader = {
  name: "hex-loader",
  transform(code, id) {
    const [path2, query] = id.split("?");
    if (query != "raw-hex")
      return null;
    const data = fs2.readFileSync(path2);
    const hex = data.toString("hex");
    return `export default '${hex}';`;
  }
};
var editor = openInEditor.configure({
  editor: "code",
  dotfiles: "allow"
});
var homedir = os.homedir();
var IS_TEST = process.env.NODE_ENV === "test";
var vite_config_default = defineConfig({
  clearScreen: false,
  test: {
    globals: true,
    environment: "jsdom",
    includeSource: ["src/**/*.{js,jsx,ts,tsx}"]
  },
  define: {
    "import.meta.vitest": "undefined"
  },
  server: {
    host: "devito.test",
    fs: {
      allow: [
        "/"
      ]
    },
    https: {
      key: fs2.readFileSync(path.join(homedir, ".ssl-certs", "devito.test-key.pem")),
      cert: fs2.readFileSync(path.join(homedir, ".ssl-certs", "devito.test.pem"))
    }
  },
  esbuild: {
    jsx: "automatic",
    target: "es2022",
    include: /\.(m?[jt]s|[jt]sx)$/,
    exclude: []
  },
  build: {
    target: "es2022",
    rollupOptions: {
      treeshake: { propertyReadSideEffects: "always" }
    }
  },
  plugins: [
    ViteUsing(),
    hexLoader,
    tsconfigPaths(),
    externalize({
      externals: [
        "node:fs/promises",
        (moduleName) => moduleName.startsWith("node:")
      ]
    }),
    // !IS_TEST && nodePolyfills({
    //   exclude: ['fs']
    // }),
    assemblyScriptPlugin({
      projectRoot: ".",
      srcMatch: "as/assembly",
      srcEntryFile: "as/assembly/index.ts"
    }),
    !IS_TEST && {
      name: "open-in-editor",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.method === "POST") {
            const fsPath = req.url.slice(1).replace("@fs", "");
            const homedir2 = os.homedir();
            console.log(fsPath, homedir2);
            let filename;
            if (fsPath.startsWith(homedir2)) {
              filename = fsPath;
            } else {
              filename = path.join(process.cwd(), fsPath);
            }
            try {
              await editor.open(filename);
            } catch (error) {
              res.writeHead(500);
              res.end(error.message);
              return;
            }
            res.writeHead(200, {
              "content-type": "text/html"
            });
            res.end("<script>window.close()</script>");
            return;
          }
          next();
        });
      }
    },
    !IS_TEST && PrintUrlsPlugin(),
    watchAndRun([
      {
        name: "scripts",
        watchKind: ["add", "change", "unlink"],
        watch: path.resolve("scripts/**.ts"),
        run: "npm run scripts",
        delay: 100
      }
    ])
  ]
});
export {
  debounce,
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidmVuZG9yL3ZpdGUtcGx1Z2luLWFzc2VtYmx5c2NyaXB0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvc3RhZ2FzL3dvcmsvc3RhZ2FzL3Zhc3RcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3N0YWdhcy93b3JrL3N0YWdhcy92YXN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3N0YWdhcy93b3JrL3N0YWdhcy92YXN0L3ZpdGUuY29uZmlnLnRzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3RcIiAvPlxuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IG9wZW5JbkVkaXRvciBmcm9tICdvcGVuLWluLWVkaXRvcidcbmltcG9ydCBvcyBmcm9tICdvcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IGV4dGVybmFsaXplIGZyb20gXCJ2aXRlLXBsdWdpbi1leHRlcm5hbGl6ZS1kZXBlbmRlbmNpZXNcIlxuaW1wb3J0IFZpdGVVc2luZyBmcm9tICd2aXRlLXBsdWdpbi11c2luZydcbmltcG9ydCB7IHdhdGNoQW5kUnVuIH0gZnJvbSAndml0ZS1wbHVnaW4td2F0Y2gtYW5kLXJ1bidcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gJ3ZpdGUtdHNjb25maWctcGF0aHMnXG5pbXBvcnQgYXNzZW1ibHlTY3JpcHRQbHVnaW4gZnJvbSBcIi4vdmVuZG9yL3ZpdGUtcGx1Z2luLWFzc2VtYmx5c2NyaXB0XCJcblxuaW1wb3J0IHR5cGUgeyBIbXJDb250ZXh0LCBQbHVnaW4gfSBmcm9tICd2aXRlJ1xuXG5pbnRlcmZhY2UgRGVib3VuY2VPcHRpb25zIHtcbiAgZmlyc3Q/OiBib29sZWFuXG4gIGxhc3Q/OiBib29sZWFuXG59XG5leHBvcnQgZnVuY3Rpb24gZGVib3VuY2U8VCBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihtczogbnVtYmVyLCBmbjogVCwgb3B0aW9ucz86IERlYm91bmNlT3B0aW9ucyk6IFQge1xuICBsZXQgcmVzb2x2aW5nID0gZmFsc2VcblxuICBsZXQgdGltZVRvUmVzb2x2ZTogbnVtYmVyXG4gIGxldCBub3c6IG51bWJlclxuICBsZXQgZGVsdGE6IG51bWJlclxuICBsZXQgY2FsbFRoaXM6IGFueVxuICBsZXQgY2FsbEFyZ3M6IGFueVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVyKCkge1xuICAgIG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpXG4gICAgZGVsdGEgPSB0aW1lVG9SZXNvbHZlIC0gbm93XG4gICAgaWYgKGRlbHRhID4gNSkge1xuICAgICAgc2V0VGltZW91dChyZXNvbHZlciwgZGVsdGEpXG4gICAgfVxuICAgIGVsc2UgaWYgKGNhbGxBcmdzKSB7XG4gICAgICBmbi5hcHBseShjYWxsVGhpcywgY2FsbEFyZ3MpXG4gICAgICByZXNvbHZpbmcgPSBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdyYXBwZXIodGhpczogYW55LCAuLi5hcmdzOiBhbnlbXSkge1xuICAgIGNhbGxUaGlzID0gdGhpc1xuICAgIGNhbGxBcmdzID0gYXJnc1xuICAgIHRpbWVUb1Jlc29sdmUgPSBwZXJmb3JtYW5jZS5ub3coKSArIG1zXG4gICAgaWYgKHJlc29sdmluZykgcmV0dXJuXG4gICAgaWYgKG9wdGlvbnM/LmZpcnN0KSB7XG4gICAgICBmbi5hcHBseShjYWxsVGhpcywgY2FsbEFyZ3MpXG4gICAgICBpZiAoIW9wdGlvbnMubGFzdCkge1xuICAgICAgICBjYWxsQXJncyA9IHZvaWQgMFxuICAgICAgfVxuICAgIH1cbiAgICByZXNvbHZpbmcgPSB0cnVlXG4gICAgc2V0VGltZW91dChyZXNvbHZlciwgbXMpXG4gIH1cblxuICByZXR1cm4gd3JhcHBlciBhcyBUXG59XG5cbmZ1bmN0aW9uIFByaW50VXJsc1BsdWdpbigpOiBQbHVnaW4ge1xuICBsZXQgaG1yQ29udGV4dDogSG1yQ29udGV4dFxuICByZXR1cm4ge1xuICAgIG5hbWU6ICd2aXRlLXBsdWdpbi1wcmludC11cmxzJyxcbiAgICBlbmZvcmNlOiAncHJlJyxcbiAgICBoYW5kbGVIb3RVcGRhdGUoY3R4KSB7XG4gICAgICBobXJDb250ZXh0ID0gY3R4XG4gICAgfSxcbiAgICBjb25maWd1cmVTZXJ2ZXIoeyB3YXRjaGVyLCBwcmludFVybHMsIGNvbmZpZyB9KSB7XG4gICAgICBwcmludFVybHMgPSBkZWJvdW5jZSgyMDAwLCBwcmludFVybHMpXG5cbiAgICAgIHdhdGNoZXIub24oJ2FsbCcsIChfLCBmaWxlKSA9PiB7XG4gICAgICAgIHByaW50VXJscygpXG5cbiAgICAgICAgY29uc3QgcXVldWUgPSBjb25maWcucGx1Z2lucy5tYXAocGx1Z2luID0+IChwbHVnaW4uaGFuZGxlSG90VXBkYXRlICYmIGhtckNvbnRleHRcbiAgICAgICAgICA/IChwbHVnaW4uaGFuZGxlSG90VXBkYXRlIGFzIGFueSkoaG1yQ29udGV4dClcbiAgICAgICAgICA6IFByb21pc2UucmVzb2x2ZSgpKSlcblxuICAgICAgICBQcm9taXNlLmFsbChxdWV1ZSkudGhlbigoZnVsbE1vZHVsZXMpID0+IHtcbiAgICAgICAgICBjb25zdCBmaWx0ZXJlZE1vZHVsZXMgPSBmdWxsTW9kdWxlcy5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0gJiYgaXRlbS5sZW5ndGgpXG5cbiAgICAgICAgICBpZiAoZmlsdGVyZWRNb2R1bGVzLmxlbmd0aCB8fCBobXJDb250ZXh0Py5tb2R1bGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gaG1yIHVwZGF0ZVxuICAgICAgICAgICAgY29uZmlnLmxvZ2dlci5pbmZvKCcnKVxuICAgICAgICAgICAgcHJpbnRVcmxzKClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWhtckNvbnRleHQ/Lm1vZHVsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoZmlsZS5lbmRzV2l0aCgnLmh0bWwnKSkge1xuICAgICAgICAgICAgICAvLyBwYWdlIHJlbG9hZFxuICAgICAgICAgICAgICBjb25maWcubG9nZ2VyLmluZm8oJycpXG4gICAgICAgICAgICAgIHByaW50VXJscygpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgaGV4TG9hZGVyOiBQbHVnaW4gPSB7XG4gIG5hbWU6ICdoZXgtbG9hZGVyJyxcbiAgdHJhbnNmb3JtKGNvZGUsIGlkKSB7XG4gICAgY29uc3QgW3BhdGgsIHF1ZXJ5XSA9IGlkLnNwbGl0KCc/JylcbiAgICBpZiAocXVlcnkgIT0gJ3Jhdy1oZXgnKVxuICAgICAgcmV0dXJuIG51bGxcblxuICAgIGNvbnN0IGRhdGEgPSBmcy5yZWFkRmlsZVN5bmMocGF0aClcbiAgICBjb25zdCBoZXggPSBkYXRhLnRvU3RyaW5nKCdoZXgnKVxuXG4gICAgcmV0dXJuIGBleHBvcnQgZGVmYXVsdCAnJHtoZXh9JztgXG4gIH1cbn1cblxuY29uc3QgZWRpdG9yID0gb3BlbkluRWRpdG9yLmNvbmZpZ3VyZSh7XG4gIGVkaXRvcjogJ2NvZGUnLFxuICBkb3RmaWxlczogJ2FsbG93Jyxcbn0pIVxuXG5jb25zdCBob21lZGlyID0gb3MuaG9tZWRpcigpXG5cbmNvbnN0IElTX1RFU1QgPSBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Rlc3QnXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBjbGVhclNjcmVlbjogZmFsc2UsXG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGVudmlyb25tZW50OiAnanNkb20nLFxuICAgIGluY2x1ZGVTb3VyY2U6IFsnc3JjLyoqLyoue2pzLGpzeCx0cyx0c3h9J10sXG4gIH0sXG4gIGRlZmluZToge1xuICAgICdpbXBvcnQubWV0YS52aXRlc3QnOiAndW5kZWZpbmVkJyxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogJ2Rldml0by50ZXN0JyxcbiAgICBmczoge1xuICAgICAgYWxsb3c6IFtcbiAgICAgICAgJy8nLFxuICAgICAgXVxuICAgIH0sXG4gICAgaHR0cHM6IHtcbiAgICAgIGtleTogZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihob21lZGlyLCAnLnNzbC1jZXJ0cycsICdkZXZpdG8udGVzdC1rZXkucGVtJykpLFxuICAgICAgY2VydDogZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihob21lZGlyLCAnLnNzbC1jZXJ0cycsICdkZXZpdG8udGVzdC5wZW0nKSksXG4gICAgfVxuICB9LFxuICBlc2J1aWxkOiB7XG4gICAganN4OiAnYXV0b21hdGljJyxcbiAgICB0YXJnZXQ6ICdlczIwMjInLFxuICAgIGluY2x1ZGU6IC9cXC4obT9banRdc3xbanRdc3gpJC8sXG4gICAgZXhjbHVkZTogW11cbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdlczIwMjInLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIHRyZWVzaGFrZTogeyBwcm9wZXJ0eVJlYWRTaWRlRWZmZWN0czogJ2Fsd2F5cycgfSxcbiAgICB9XG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICBWaXRlVXNpbmcoKSxcbiAgICBoZXhMb2FkZXIsXG4gICAgdHNjb25maWdQYXRocygpLFxuICAgIGV4dGVybmFsaXplKHtcbiAgICAgIGV4dGVybmFsczogW1xuICAgICAgICAnbm9kZTpmcy9wcm9taXNlcycsXG4gICAgICAgIChtb2R1bGVOYW1lKSA9PiBtb2R1bGVOYW1lLnN0YXJ0c1dpdGgoJ25vZGU6JylcbiAgICAgIF0sXG4gICAgfSksXG4gICAgLy8gIUlTX1RFU1QgJiYgbm9kZVBvbHlmaWxscyh7XG4gICAgLy8gICBleGNsdWRlOiBbJ2ZzJ11cbiAgICAvLyB9KSxcbiAgICBhc3NlbWJseVNjcmlwdFBsdWdpbih7XG4gICAgICBwcm9qZWN0Um9vdDogJy4nLFxuICAgICAgc3JjTWF0Y2g6ICdhcy9hc3NlbWJseScsXG4gICAgICBzcmNFbnRyeUZpbGU6ICdhcy9hc3NlbWJseS9pbmRleC50cydcbiAgICB9KSxcbiAgICAhSVNfVEVTVCAmJiB7XG4gICAgICBuYW1lOiAnb3Blbi1pbi1lZGl0b3InLFxuICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICAgICAgICAgIGlmIChyZXEubWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGZzUGF0aCA9IHJlcS51cmwhLnNsaWNlKDEpLnJlcGxhY2UoJ0BmcycsICcnKVxuICAgICAgICAgICAgY29uc3QgaG9tZWRpciA9IG9zLmhvbWVkaXIoKVxuICAgICAgICAgICAgY29uc29sZS5sb2coZnNQYXRoLCBob21lZGlyKVxuICAgICAgICAgICAgbGV0IGZpbGVuYW1lOiBzdHJpbmdcbiAgICAgICAgICAgIGlmIChmc1BhdGguc3RhcnRzV2l0aChob21lZGlyKSkge1xuICAgICAgICAgICAgICBmaWxlbmFtZSA9IGZzUGF0aFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGZpbGVuYW1lID0gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksIGZzUGF0aClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGF3YWl0IGVkaXRvci5vcGVuKGZpbGVuYW1lKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwKVxuICAgICAgICAgICAgICByZXMuZW5kKChlcnJvciBhcyBFcnJvcikubWVzc2FnZSlcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgICAgICAgICAnY29udGVudC10eXBlJzogJ3RleHQvaHRtbCdcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICByZXMuZW5kKCc8c2NyaXB0PndpbmRvdy5jbG9zZSgpPC9zY3JpcHQ+JylcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICBuZXh0KClcbiAgICAgICAgfSlcbiAgICAgIH0sXG4gICAgfSxcbiAgICAhSVNfVEVTVCAmJiBQcmludFVybHNQbHVnaW4oKSxcbiAgICB3YXRjaEFuZFJ1bihbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdzY3JpcHRzJyxcbiAgICAgICAgd2F0Y2hLaW5kOiBbJ2FkZCcsICdjaGFuZ2UnLCAndW5saW5rJ10sXG4gICAgICAgIHdhdGNoOiBwYXRoLnJlc29sdmUoJ3NjcmlwdHMvKioudHMnKSxcbiAgICAgICAgcnVuOiAnbnBtIHJ1biBzY3JpcHRzJyxcbiAgICAgICAgZGVsYXk6IDEwMFxuICAgICAgfVxuICAgIF0pXG4gIF0sXG59KVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9zdGFnYXMvd29yay9zdGFnYXMvdmFzdC92ZW5kb3JcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3N0YWdhcy93b3JrL3N0YWdhcy92YXN0L3ZlbmRvci92aXRlLXBsdWdpbi1hc3NlbWJseXNjcmlwdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9zdGFnYXMvd29yay9zdGFnYXMvdmFzdC92ZW5kb3Ivdml0ZS1wbHVnaW4tYXNzZW1ibHlzY3JpcHQudHNcIjsvLyBodHRwczovL2dpdGh1Yi5jb20vZWQtMjU1MTkvdml0ZS1wbHVnaW4tYXNzZW1ibHlzY3JpcHQtYXNjL2Jsb2IvbWFpbi9zcmMvaW5kZXgudHNcbmltcG9ydCBhc2MgZnJvbSAnYXNzZW1ibHlzY3JpcHQvZGlzdC9hc2MnXG5pbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgeyBqb2luLCByZXNvbHZlLCBzZXAgfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHR5cGUgeyBQbHVnaW4gfSBmcm9tICd2aXRlJ1xuXG5pbnRlcmZhY2UgQXNzZW1ibHlTY3JpcHRQbHVnaW5PcHRpb25zIHtcbiAgcHJvamVjdFJvb3Q6IHN0cmluZ1xuICBzcmNNYXRjaDogc3RyaW5nXG4gIHNyY0VudHJ5RmlsZTogc3RyaW5nXG59XG5cbmNvbnN0IGRlZmF1bHRPcHRpb25zOiBBc3NlbWJseVNjcmlwdFBsdWdpbk9wdGlvbnMgPSB7XG4gIHByb2plY3RSb290OiAnLicsXG4gIHNyY01hdGNoOiAnYXMvYXNzZW1ibHknLFxuICBzcmNFbnRyeUZpbGU6ICdhcy9hc3NlbWJseS9pbmRleC50cycsXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbXBpbGUoZW50cnlGaWxlOiBzdHJpbmcsIG1vZGU6ICdkZWJ1ZycgfCAncmVsZWFzZScpIHtcbiAgY29uc29sZS5sb2coJ1thc2NdIGNvbXBpbGluZy4uLicpXG5cbiAgY29uc3QgeyBlcnJvciwgc3Rkb3V0LCBzdGRlcnIsIHN0YXRzIH0gPSBhd2FpdCBhc2MubWFpbihbXG4gICAgZW50cnlGaWxlLFxuICAgICctLXRhcmdldCcsIG1vZGUsXG4gICAgJy0tdHJhbnNmb3JtJywgJy4vdmVuZG9yL3Vucm9sbC5qcycsXG4gICAgJy0tdHJhbnNmb3JtJywgJy4vdmVuZG9yL3VwZGF0ZS1kc3AtZ2Vucy5qcycsXG4gIF0sIHt9KVxuXG4gIGlmIChlcnJvcikge1xuICAgIGNvbnNvbGUubG9nKCdDb21waWxhdGlvbiBmYWlsZWQ6ICcgKyBlcnJvci5tZXNzYWdlKVxuICAgIGNvbnNvbGUubG9nKHN0ZG91dC50b1N0cmluZygpKVxuICAgIGNvbnNvbGUubG9nKHN0ZGVyci50b1N0cmluZygpKVxuICB9XG4gIGVsc2Uge1xuICAgIGNvbnNvbGUubG9nKHN0ZG91dC50b1N0cmluZygpKVxuICAgIGNvbnNvbGUubG9nKHN0YXRzLnRvU3RyaW5nKCkpXG4gICAgY29uc3QgbWFwRmlsZSA9IGpvaW4oX19kaXJuYW1lLCAnLi4nLCAnYXMnLCAnYnVpbGQnLCAnYXNzZW1ibHkud2FzbS5tYXAnKVxuICAgIGNvbnN0IG1hcEpzb24gPSBmcy5yZWFkRmlsZVN5bmMobWFwRmlsZSwgJ3V0Zi04JylcbiAgICBjb25zdCBtYXAgPSBKU09OLnBhcnNlKG1hcEpzb24pXG5cbiAgICAvLyBUaGlzIGlzIHRoZSBtYWdpYyB0aGF0IG1ha2VzIHBhdGhzIHdvcmsgZm9yIG9wZW4taW4tZWRpdG9yIGZyb20gZGV2dG9vbHMgY29uc29sZS5cbiAgICAvLyBUT0RPOiBzaG91bGQgYmUgbWFkZSBjb25maWd1cmFibGUuXG4gICAgbWFwLnNvdXJjZVJvb3QgPSAnLydcblxuICAgIGZzLndyaXRlRmlsZVN5bmMobWFwRmlsZSwgSlNPTi5zdHJpbmdpZnkobWFwKSwgJ3V0Zi04JylcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhc3NlbWJseVNjcmlwdFBsdWdpbihcbiAgdXNlck9wdGlvbnM6IFBhcnRpYWw8QXNzZW1ibHlTY3JpcHRQbHVnaW5PcHRpb25zPiA9IGRlZmF1bHRPcHRpb25zXG4pOiBQbHVnaW4ge1xuICBjb25zdCBvcHRpb25zID0ge1xuICAgIC4uLmRlZmF1bHRPcHRpb25zLFxuICAgIC4uLnVzZXJPcHRpb25zLFxuICB9XG5cbiAgY29uc3QgZW50cnlGaWxlID0gam9pbihvcHRpb25zLnByb2plY3RSb290LCBvcHRpb25zLnNyY0VudHJ5RmlsZSlcbiAgY29uc3QgbWF0Y2hQYXRoID0gcmVzb2x2ZShqb2luKG9wdGlvbnMucHJvamVjdFJvb3QsIG9wdGlvbnMuc3JjTWF0Y2gpKVxuXG4gIGxldCBoYW5kbGVkVGltZXN0YW1wOiBhbnlcblxuICByZXR1cm4ge1xuICAgIG5hbWU6ICd2aXRlLXBsdWdpbi1hc3NlbWJseXNjcmlwdC1hc2MnLFxuICAgIGFzeW5jIGhhbmRsZUhvdFVwZGF0ZSh7IGZpbGUsIHRpbWVzdGFtcCB9KSB7XG4gICAgICBpZiAoZmlsZS5zdGFydHNXaXRoKG1hdGNoUGF0aCkpIHtcbiAgICAgICAgaWYgKHRpbWVzdGFtcCA9PT0gaGFuZGxlZFRpbWVzdGFtcCkgcmV0dXJuXG4gICAgICAgIGhhbmRsZWRUaW1lc3RhbXAgPSB0aW1lc3RhbXBcbiAgICAgICAgYXdhaXQgY29tcGlsZShlbnRyeUZpbGUsICdkZWJ1ZycpXG4gICAgICB9XG4gICAgfSxcbiAgICBhc3luYyBidWlsZFN0YXJ0KCkge1xuICAgICAgYXdhaXQgY29tcGlsZShlbnRyeUZpbGUsICdyZWxlYXNlJylcbiAgICB9LFxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsT0FBT0EsU0FBUTtBQUNmLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sUUFBUTtBQUNmLE9BQU8sVUFBVTtBQUNqQixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLGVBQWU7QUFDdEIsU0FBUyxtQkFBbUI7QUFDNUIsT0FBTyxtQkFBbUI7OztBQ1IxQixPQUFPLFNBQVM7QUFDaEIsT0FBTyxRQUFRO0FBQ2YsU0FBUyxNQUFNLGVBQW9CO0FBSG5DLElBQU0sbUNBQW1DO0FBWXpDLElBQU0saUJBQThDO0FBQUEsRUFDbEQsYUFBYTtBQUFBLEVBQ2IsVUFBVTtBQUFBLEVBQ1YsY0FBYztBQUNoQjtBQUVBLGVBQWUsUUFBUSxXQUFtQixNQUEyQjtBQUNuRSxVQUFRLElBQUksb0JBQW9CO0FBRWhDLFFBQU0sRUFBRSxPQUFPLFFBQVEsUUFBUSxNQUFNLElBQUksTUFBTSxJQUFJLEtBQUs7QUFBQSxJQUN0RDtBQUFBLElBQ0E7QUFBQSxJQUFZO0FBQUEsSUFDWjtBQUFBLElBQWU7QUFBQSxJQUNmO0FBQUEsSUFBZTtBQUFBLEVBQ2pCLEdBQUcsQ0FBQyxDQUFDO0FBRUws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QU8sS0FBSyxRQUFRO0FBQUEsWUFDNUIsU0FDTyxPQUFPO0FBQ1osa0JBQUksVUFBVSxHQUFHO0FBQ2pCLGtCQUFJLElBQUssTUFBZ0IsT0FBTztBQUNoQztBQUFBLFlBQ0Y7QUFDQSxnQkFBSSxVQUFVLEtBQUs7QUFBQSxjQUNqQixnQkFBZ0I7QUFBQSxZQUNsQixDQUFDO0FBQ0QsZ0JBQUksSUFBSSxpQ0FBaUM7QUFDekM7QUFBQSxVQUNGO0FBQ0EsZUFBSztBQUFBLFFBQ1AsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsSUFDQSxDQUFDLFdBQVcsZ0JBQWdCO0FBQUEsSUFDNUIsWUFBWTtBQUFBLE1BQ1Y7QUFBQSxRQUNFLE1BQU07QUFBQSxRQUNOLFdBQVcsQ0FBQyxPQUFPLFVBQVUsUUFBUTtBQUFBLFFBQ3JDLE9BQU8sS0FBSyxRQUFRLGVBQWU7QUFBQSxRQUNuQyxLQUFLO0FBQUEsUUFDTCxPQUFPO0FBQUEsTUFDVDtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJmcyIsICJwYXRoIiwgImZzIiwgImhvbWVkaXIiXQp9Cg==
