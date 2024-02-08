import { instantiate } from './build/assembly.js'

let mod: WebAssembly.Module

if (import.meta.env) {
  const wasm = (await import('./build/assembly.wasm?raw-hex')).default
  const fromHexString = (hexString: string) => {
    return Uint8Array.from(
      hexString.match(/.{1,2}/g)!.map((byte) =>
        parseInt(byte, 16)
      )
    )
  }
  mod = await WebAssembly.compile(fromHexString(wasm))
}
else {
  const wasm = (await import('./build/assembly.wasm?url')).default
  mod = await WebAssembly.compileStreaming(fetch(wasm))
}

const result = await instantiate(mod, {
  env: {
    logf: console.log,
    logf6: console.log,
  }
})

export default result
