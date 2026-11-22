import type * as ast from "../../../syntax/index.js";
import type { Template } from "../../forms/index.js";
import type { Context } from "../context.js";
import { templateOf } from "../templates.js";
import { noEntries } from "./neutrals.js";

export function workflowInputOf(
  process: ast.WorkflowProcess,
  context: Context,
): Template {
  return templateOf(process.input, noEntries, context);
}
