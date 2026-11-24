import type { WasmRuntime } from "./types.js";

declare const WebAssembly: WasmRuntime;

export const wasmRuntime: WasmRuntime = WebAssembly;
