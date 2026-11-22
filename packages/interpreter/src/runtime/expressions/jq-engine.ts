import { loadJq as loadEngine } from "jq-wasm";
import { InterpreterError } from "../faults/index.js";
import { DirectLanguage } from "./direct-language.js";
import { JqLanguage } from "./jq-language.js";
import type { ExpressionLanguage, WasmInstance, WasmMemory } from "./types.js";
import { wasmRuntime } from "./wasm-runtime.js";

type Instantiated = (instance: WasmInstance, module: object) => void;

type Instantiation = (imports: object, onSuccess: Instantiated) => void;

export async function jqLanguageOf(
  binary: Uint8Array,
): Promise<ExpressionLanguage> {
  const module = await wasmRuntime.compile(binary);
  const instantiation = Promise.withResolvers<WasmInstance>();
  const instantiateWasm = instantiatorOf(module, instantiation);

  const loading = loadEngine({ instantiateWasm });
  const [jq, instance] = await Promise.all([loading, instantiation.promise]);

  const exported = Object.values(instance.exports);
  const memory = exported.find(isMemory);

  if (memory === undefined) {
    throw new InterpreterError("The expression engine exports no memory.");
  }

  const engine = new JqLanguage(jq, memory);
  return new DirectLanguage(engine);
}

function instantiatorOf(
  module: object,
  instantiation: PromiseWithResolvers<WasmInstance>,
): Instantiation {
  return (imports, onSuccess) => {
    const instantiated = wasmRuntime.instantiate(module, imports);

    instantiated
      .then((instance) => {
        onSuccess(instance, module);
        instantiation.resolve(instance);
      })
      .catch(instantiation.reject);
  };
}

function isMemory(value: unknown): value is WasmMemory {
  return value instanceof wasmRuntime.Memory;
}
