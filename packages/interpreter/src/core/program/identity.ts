import type { WorkflowIdentity } from "../../api/index.js";
import type * as ast from "../../syntax/index.js";

export function identityOf(header: ast.DocumentHeader): WorkflowIdentity {
  const identity: WorkflowIdentity = {
    namespace: header.namespace,
    name: header.name,
    version: header.version,
    dsl: header.dsl,
  };

  return Object.freeze(identity);
}
