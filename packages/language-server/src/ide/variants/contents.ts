import type { JsonObject } from "interpreter/front-end";
import type { StepVariant } from "./variants.js";

const printedJson = "${ fromjson }";

const keptInput = "${ $input + . }";

const validationError =
  "https://open-workflow-specification.org/spec/1.0.0/errors/validation";

const jsResult = "const result = {};\nconsole.log(JSON.stringify(result));\n";

const pythonResult = "import json\n\nresult = {}\nprint(json.dumps(result))\n";

export function startingContentOf(variant: StepVariant): JsonObject {
  switch (variant) {
    case "http":
      return { call: "http", with: { method: "get", endpoint: "" } };
    case "openapi":
      return {
        call: "openapi",
        with: { document: { endpoint: "" }, operationId: "" },
      };
    case "grpc":
      return {
        call: "grpc",
        with: {
          proto: { endpoint: "" },
          service: { name: "", host: "" },
          method: "",
        },
      };
    case "asyncapi":
      return {
        call: "asyncapi",
        with: { document: { endpoint: "" }, operation: "", message: {} },
      };
    case "mcp":
      return {
        call: "mcp",
        with: {
          method: "tools/call",
          parameters: { name: "" },
          transport: { http: { endpoint: "" } },
        },
      };
    case "a2a":
      return { call: "a2a", with: { method: "message/send", server: "" } };
    case "script-js":
      return {
        run: { script: { language: "js", code: jsResult } },
        output: { as: printedJson },
      };
    case "script-python":
      return {
        run: { script: { language: "python", code: pythonResult } },
        output: { as: printedJson },
      };
    case "shell":
      return { run: { shell: { command: "" } } };
    case "container":
      return { run: { container: { image: "" } } };
    case "workflow":
      return { run: { workflow: { namespace: "", name: "", version: "" } } };
    case "do":
      return { do: [] };
    case "emit":
      return { emit: { event: { with: { type: "" } } } };
    case "for":
      return { for: { each: "item", in: "" }, do: [] };
    case "fork":
      return { fork: { branches: [] } };
    case "listen":
      return { listen: { to: { one: { with: { type: "" } } } } };
    case "raise":
      return {
        raise: { error: { type: validationError, status: 400, title: "" } },
      };
    case "set":
      return { set: { value: "" }, output: { as: keptInput } };
    case "switch":
      return { switch: [{ default: { then: "continue" } }] };
    case "try":
      return { try: [], catch: {} };
    case "wait":
      return { wait: "PT30M" };
  }
}
