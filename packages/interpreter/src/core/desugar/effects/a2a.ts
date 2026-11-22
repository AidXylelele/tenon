import type * as ast from "../../../syntax/index.js";
import {
  type A2aTemplate,
  type AgentCardTemplate,
  type AgentServerTemplate,
  a2aTemplate,
  agentCardTemplate,
  agentServerTemplate,
} from "../../forms/index.js";
import type { Context } from "../context.js";
import { templateOf } from "../templates.js";
import { endpointTemplateOf, resourceTemplateOf } from "./endpoints.js";

export function a2aTemplateOf(
  call: ast.A2aCall,
  context: Context,
): A2aTemplate {
  const agent = agentOf(call.agent, context);
  const parameters = templateOf(call.parameters, null, context);

  return a2aTemplate({ method: call.method, agent, parameters });
}

function agentOf(
  agent: ast.A2aAgentCard | ast.A2aServer,
  context: Context,
): AgentCardTemplate | AgentServerTemplate {
  switch (agent.kind) {
    case "agentCard":
      return agentCardOf(agent, context);
    case "server":
      return agentServerOf(agent, context);
  }
}

function agentCardOf(
  card: ast.A2aAgentCard,
  context: Context,
): AgentCardTemplate {
  const resource = resourceTemplateOf(card.resource, context);
  return agentCardTemplate({ resource });
}

function agentServerOf(
  server: ast.A2aServer,
  context: Context,
): AgentServerTemplate {
  const endpoint = endpointTemplateOf(server.endpoint, context);
  return agentServerTemplate({ endpoint });
}
