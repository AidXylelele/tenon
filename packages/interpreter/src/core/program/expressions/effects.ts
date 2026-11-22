import type {
  A2aTemplate,
  AsyncApiPublishTemplate,
  AsyncApiRequestTemplate,
  AsyncApiServerTemplate,
  AttributeValue,
  AuthenticationTemplate,
  ContainerTemplate,
  EffectTemplate,
  EmitTemplate,
  EndpointTemplate,
  Expression,
  GrpcTemplate,
  HttpTemplate,
  McpTemplate,
  OAuth2TemplateProperties,
  OAuth2TokenTemplate,
  OpenApiTemplate,
  ProcessTemplate,
  ResourceTemplate,
  ScriptTemplate,
  ShellTemplate,
  TimerTemplate,
  UriTerm,
  WorkflowTemplate,
} from "../../forms/index.js";
import {
  durationExpressionsOf,
  partsExpressionsOf,
  templatesExpressionsOf,
} from "./values.js";

const none: readonly Expression[] = [];

export function effectExpressionsOf(
  effect: EffectTemplate,
): readonly Expression[] {
  switch (effect.kind) {
    case "http":
    case "openapi":
    case "grpc":
    case "asyncapi":
      return remoteExpressionsOf(effect);
    case "a2a":
      return a2aExpressionsOf(effect);
    case "mcp":
      return mcpExpressionsOf(effect);
    case "emit":
    case "timer":
    case "process":
    case "workflow":
      return localExpressionsOf(effect);
    case "resource":
      return resourceExpressionsOf(effect);
  }
}

export function resourceExpressionsOf(
  resource: ResourceTemplate,
): readonly Expression[] {
  const name = partsExpressionsOf([resource.name]);
  const endpoint = endpointExpressionsOf(resource.endpoint);

  return [...name, ...endpoint];
}

export function asyncApiRequestExpressionsOf(
  request: AsyncApiRequestTemplate,
): readonly Expression[] {
  const document = resourceExpressionsOf(request.document);
  const server = serverExpressionsOf(request.server);
  const authentication = authenticationExpressionsOf(request.authentication);

  return [...document, ...server, ...authentication];
}

function remoteExpressionsOf(
  effect:
    HttpTemplate | OpenApiTemplate | GrpcTemplate | AsyncApiPublishTemplate,
): readonly Expression[] {
  switch (effect.kind) {
    case "http":
      return httpExpressionsOf(effect);
    case "openapi":
      return openApiExpressionsOf(effect);
    case "grpc":
      return grpcExpressionsOf(effect);
    case "asyncapi":
      return publishExpressionsOf(effect);
  }
}

function localExpressionsOf(
  effect: EmitTemplate | TimerTemplate | ProcessTemplate | WorkflowTemplate,
): readonly Expression[] {
  switch (effect.kind) {
    case "emit":
      return emitExpressionsOf(effect);
    case "timer":
      return durationExpressionsOf(effect.duration);
    case "process":
      return processExpressionsOf(effect.process);
    case "workflow":
      return templatesExpressionsOf([effect.input]);
  }
}

function httpExpressionsOf(http: HttpTemplate): readonly Expression[] {
  const templates = [http.method, http.headers, http.body, http.query];
  const request = templatesExpressionsOf(templates);
  const endpoint = endpointExpressionsOf(http.endpoint);

  return [...request, ...endpoint];
}

function openApiExpressionsOf(call: OpenApiTemplate): readonly Expression[] {
  const document = resourceExpressionsOf(call.document);
  const parameters = templatesExpressionsOf([call.parameters]);
  const authentication = authenticationExpressionsOf(call.authentication);

  return [...document, ...parameters, ...authentication];
}

function grpcExpressionsOf(call: GrpcTemplate): readonly Expression[] {
  const service = call.service;
  const proto = resourceExpressionsOf(call.proto);
  const port = partsExpressionsOf([service.port]);
  const methodArguments = templatesExpressionsOf([call.arguments]);
  const authentication = authenticationExpressionsOf(service.authentication);

  return [...proto, ...port, ...methodArguments, ...authentication];
}

function publishExpressionsOf(
  publish: AsyncApiPublishTemplate,
): readonly Expression[] {
  const request = asyncApiRequestExpressionsOf(publish);
  const message = templatesExpressionsOf([publish.payload, publish.headers]);

  return [...request, ...message];
}

function serverExpressionsOf(
  server: AsyncApiServerTemplate,
): readonly Expression[] {
  switch (server.kind) {
    case "default":
      return none;
    case "named":
      return templatesExpressionsOf([server.variables]);
  }
}

function a2aExpressionsOf(call: A2aTemplate): readonly Expression[] {
  const agent = agentExpressionsOf(call.agent);
  const parameters = templatesExpressionsOf([call.parameters]);

  return [...agent, ...parameters];
}

function agentExpressionsOf(
  agent: A2aTemplate["agent"],
): readonly Expression[] {
  switch (agent.kind) {
    case "agentCard":
      return resourceExpressionsOf(agent.resource);
    case "server":
      return endpointExpressionsOf(agent.endpoint);
  }
}

function mcpExpressionsOf(call: McpTemplate): readonly Expression[] {
  const parameters = templatesExpressionsOf([call.parameters]);
  const transport = transportExpressionsOf(call.transport);

  return [...parameters, ...transport];
}

function transportExpressionsOf(
  transport: McpTemplate["transport"],
): readonly Expression[] {
  switch (transport.kind) {
    case "http": {
      const endpoint = endpointExpressionsOf(transport.endpoint);
      const headers = templatesExpressionsOf([transport.headers]);
      return [...endpoint, ...headers];
    }
    case "stdio":
      return templatesExpressionsOf([
        transport.command,
        transport.arguments,
        transport.environment,
      ]);
  }
}

function emitExpressionsOf(emit: EmitTemplate): readonly Expression[] {
  const values = emit.attributes.map((attribute) => attribute.value);
  return values.flatMap(attributeExpressionsOf);
}

function attributeExpressionsOf(value: AttributeValue): readonly Expression[] {
  switch (value.kind) {
    case "evaluated":
      return templatesExpressionsOf([value.template]);
    case "uri":
    case "derivedId":
    case "stepTime":
      return none;
  }
}

function processExpressionsOf(
  process: ProcessTemplate["process"],
): readonly Expression[] {
  switch (process.kind) {
    case "container":
      return containerExpressionsOf(process);
    case "script":
      return scriptExpressionsOf(process);
    case "shell":
      return shellExpressionsOf(process);
  }
}

function containerExpressionsOf(
  container: ContainerTemplate,
): readonly Expression[] {
  const image = templatesExpressionsOf([container.image]);
  const named = partsExpressionsOf([container.name, container.command]);
  const maps = templatesExpressionsOf([
    container.ports,
    container.volumes,
    container.environment,
  ]);
  const stdin = partsExpressionsOf([container.stdin]);
  const commandArguments = templatesExpressionsOf([container.arguments]);
  const lifetime = lifetimeExpressionsOf(container.lifetime);

  return [
    ...image,
    ...named,
    ...maps,
    ...stdin,
    ...commandArguments,
    ...lifetime,
  ];
}

function lifetimeExpressionsOf(
  lifetime: ContainerTemplate["lifetime"],
): readonly Expression[] {
  switch (lifetime.kind) {
    case "always":
    case "never":
      return none;
    case "eventually":
      return durationExpressionsOf(lifetime.after);
  }
}

function scriptExpressionsOf(script: ScriptTemplate): readonly Expression[] {
  const source = scriptSourceExpressionsOf(script.source);
  const stdin = partsExpressionsOf([script.stdin]);
  const templates = templatesExpressionsOf([
    script.arguments,
    script.environment,
  ]);

  return [...source, ...stdin, ...templates];
}

function scriptSourceExpressionsOf(
  source: ScriptTemplate["source"],
): readonly Expression[] {
  switch (source.kind) {
    case "inline":
      return none;
    case "resource":
      return resourceExpressionsOf(source);
  }
}

function shellExpressionsOf(shell: ShellTemplate): readonly Expression[] {
  const command = templatesExpressionsOf([shell.command]);
  const stdin = partsExpressionsOf([shell.stdin]);
  const commandArguments = templatesExpressionsOf([shell.arguments]);
  const directory = partsExpressionsOf([shell.directory]);
  const environment = templatesExpressionsOf([shell.environment]);

  return [
    ...command,
    ...stdin,
    ...commandArguments,
    ...directory,
    ...environment,
  ];
}

function endpointExpressionsOf(
  endpoint: EndpointTemplate,
): readonly Expression[] {
  const uri = uriExpressionsOf(endpoint.uri);
  const authentication = authenticationExpressionsOf(endpoint.authentication);

  return [...uri, ...authentication];
}

function uriExpressionsOf(uri: UriTerm): readonly Expression[] {
  switch (uri.kind) {
    case "uri":
      return none;
    case "expression":
      return [uri];
  }
}

function authenticationExpressionsOf(
  authentication: AuthenticationTemplate,
): readonly Expression[] {
  switch (authentication.kind) {
    case "none":
    case "secret":
      return none;
    case "basic":
    case "digest":
      return templatesExpressionsOf([
        authentication.username,
        authentication.password,
      ]);
    case "bearer":
      return templatesExpressionsOf([authentication.token]);
    case "oauth2":
    case "oidc":
      return oauth2ExpressionsOf(authentication);
  }
}

function oauth2ExpressionsOf(
  properties: OAuth2TemplateProperties,
): readonly Expression[] {
  const client = properties.client;
  const clientParts = partsExpressionsOf([
    client.id,
    client.secret,
    client.assertion,
  ]);
  const lists = templatesExpressionsOf([
    properties.issuers,
    properties.scopes,
    properties.audiences,
  ]);
  const credentials = partsExpressionsOf([
    properties.username,
    properties.password,
  ]);
  const subject = tokenExpressionsOf(properties.subject);
  const actor = tokenExpressionsOf(properties.actor);

  return [...clientParts, ...lists, ...credentials, ...subject, ...actor];
}

function tokenExpressionsOf(token: OAuth2TokenTemplate): readonly Expression[] {
  switch (token.kind) {
    case "none":
      return none;
    case "given":
      return templatesExpressionsOf([token.token, token.type]);
  }
}
