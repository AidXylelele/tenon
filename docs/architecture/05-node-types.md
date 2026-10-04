# Node types

## Catalogue

The manifest model `NodeType` is part of the domain. Each type contributes a manifest instance and an executor from `interface-adapters/node-types/<type>/`; the registry collects them from dependency injection at startup and serves them through the `NodeTypeCatalog` port. `GET /node-types` returns the manifests. There is no catalogue table in the database.

| Rule          | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Reference     | A workflow version references `nodeTypeId@version`                                             |
| Delivery      | New types and new type versions ship with a platform release                                   |
| Compatibility | A type version stays in the catalogue while a published workflow version references it         |
| Validation    | The editor validates node parameters against the manifest schema; the API validates on publish |

## Manifest

| Field            | Content                                                       |
| ---------------- | ------------------------------------------------------------- |
| `id`, `version`  | Identity of the type                                          |
| `kind`           | `trigger`, `action`, `transform`, `ai`                        |
| `category`       | Grouping for the editor                                       |
| `parameters`     | JSON Schema of node parameters                                |
| `credentialType` | Required credential type, if any                              |
| `ports`          | Input and output ports                                        |
| `dataMode`       | `item`, `batch`, `all`                                        |
| `retry`          | Attempts, backoff, timeout per step                           |
| `polling`        | For polling triggers: poll operation and cursor shape         |
| `webhook`        | For webhook triggers: event schema and signature verification |

## Code Node

| Aspect        | Value                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Runtime       | Node.js inside go-judge; TypeScript is transpiled by the worker before the call                                                |
| Request       | Fixed harness, `args` and `env` built by the worker; the user supplies only the script                                         |
| Input, output | Input JSON on stdin; output JSON on stdout with a collector limit; stderr returned as diagnostics                              |
| Limits        | `cpuLimit` and `clockLimit` both set; `memoryLimit`, `procLimit`, `copyOutMax`; input batch bounded by the sandbox input limit |
| Isolation     | No network; no host files (`src` never used); sandbox reachable only from the worker on `localhost` with a token               |

| Sandbox status                                                                                                      | Outcome                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `Accepted`                                                                                                          | Output parsed and validated against the node output schema |
| `Nonzero Exit Status`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Output Limit Exceeded`, `Dangerous Syscall` | User error, not retried                                    |
| `Signalled`                                                                                                         | Cancelled by the worker, or platform error                 |
| `File Error`, `Internal Error`, HTTP 500                                                                            | Platform error, retried on another replica                 |

## AI Agent Node

| Aspect          | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Definition      | A team of agents: name, instruction, model, input JSON Schema, output JSON Schema                                              |
| Routing         | Sequential, conditional, or parallel with aggregation                                                                          |
| Output          | Structured output validated against the agent schema; a bounded number of retries with the validation error; then a user error |
| Limits          | Tokens, cost and iterations per node execution                                                                                 |
| Execution       | One step per node; the step is safe to retry                                                                                   |
| Tools           | Not provided in version 1                                                                                                      |
| Provider access | `ModelProviderGateway` adapter over the provider SDK                                                                           |
