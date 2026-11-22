import { JsonSchemas } from "../../runtime/index.js";
import workflowSchema from "./workflow-schema.json" with { type: "json" };

export function standardSchemas(): JsonSchemas {
  return new JsonSchemas([workflowSchema]);
}
