import type {
  A2aTemplate,
  AsyncApiProtocolChoice,
  AsyncApiPublishTemplate,
  AsyncApiRequestTemplate,
  AsyncApiServerTemplate,
  AsyncApiTarget,
  AttributeTemplate,
  AttributeValue,
  AuthenticationTemplate,
  ContainerTemplate,
  Decoder,
  EffectTemplate,
  EmitTemplate,
  EndpointTemplate,
  GrpcTemplate,
  HttpDecoder,
  HttpTemplate,
  McpTemplate,
  OAuth2TemplateProperties,
  OAuth2Template,
  OAuth2TokenTemplate,
  OidcTemplate,
  OpenApiTemplate,
  OptionalPart,
  ProcessTemplate,
  ResourceTemplate,
  ScriptTemplate,
  ShellTemplate,
  Template,
  TimerTemplate,
  WorkflowTemplate,
} from "../forms/index.js";
import { groupOf, labelledOf, leafOf, lineOf, type Line } from "./line.js";
import {
  durationText,
  templateText,
  uriTemplateText,
  uriTermText,
} from "./values.js";

function fieldOf(name: string, template: Template): Line {
  const text = templateText(template);
  return labelledOf(name, text);
}

function partOf(name: string, part: OptionalPart): Line {
  switch (part.kind) {
    case "omitted":
      return labelledOf(name, "omitted");
    case "written":
      return fieldOf(name, part.template);
  }
}

function tokenLineOf(name: string, token: OAuth2TokenTemplate): Line {
  switch (token.kind) {
    case "none":
      return leafOf(`${name} none`);
    case "given": {
      const fields = [
        fieldOf("token", token.token),
        fieldOf("type", token.type),
      ];
      return groupOf(name, fields);
    }
  }
}

function oauth2LinesOf(properties: OAuth2TemplateProperties): readonly Line[] {
  const client = properties.client;
  return [
    partOf("client.id", client.id),
    partOf("client.secret", client.secret),
    partOf("client.assertion", client.assertion),
    fieldOf("issuers", properties.issuers),
    fieldOf("scopes", properties.scopes),
    fieldOf("audiences", properties.audiences),
    partOf("username", properties.username),
    partOf("password", properties.password),
    tokenLineOf("subject", properties.subject),
    tokenLineOf("actor", properties.actor),
  ];
}

function oauth2HeadOf(properties: OAuth2TemplateProperties): string {
  const client = properties.client.authentication;
  const authority = uriTemplateText(properties.authority);
  return `${authority} ${properties.grant} ${properties.encoding} ${client}`;
}

function oauth2LineOf(authentication: OAuth2Template): Line {
  const endpoints = authentication.endpoints;
  const properties = oauth2HeadOf(authentication);
  const head = `authentication oauth2 ${properties}`;
  const token = uriTemplateText(endpoints.token);
  const revocation = uriTemplateText(endpoints.revocation);
  const introspection = uriTemplateText(endpoints.introspection);
  const fields = [
    labelledOf("token", token),
    labelledOf("revocation", revocation),
    labelledOf("introspection", introspection),
    ...oauth2LinesOf(authentication),
  ];

  return lineOf(head, fields);
}

function oidcLineOf(authentication: OidcTemplate): Line {
  const properties = oauth2HeadOf(authentication);
  const head = `authentication oidc ${properties}`;
  const fields = oauth2LinesOf(authentication);

  return lineOf(head, fields);
}

function authenticationLineOf(authentication: AuthenticationTemplate): Line {
  switch (authentication.kind) {
    case "none":
      return leafOf("authentication none");
    case "basic":
    case "digest": {
      const fields = [
        fieldOf("username", authentication.username),
        fieldOf("password", authentication.password),
      ];
      return groupOf(`authentication ${authentication.kind}`, fields);
    }
    case "bearer": {
      const token = fieldOf("token", authentication.token);
      return groupOf("authentication bearer", [token]);
    }
    case "oauth2":
      return oauth2LineOf(authentication);
    case "oidc":
      return oidcLineOf(authentication);
    case "secret":
      return leafOf(
        `authentication secret ${authentication.scheme} ${authentication.secret}`,
      );
  }
}

function endpointLinesOf(endpoint: EndpointTemplate): readonly Line[] {
  const uri = uriTermText(endpoint.uri);
  return [
    labelledOf("uri", uri),
    authenticationLineOf(endpoint.authentication),
  ];
}

export function resourceLineOf(
  label: string,
  resource: ResourceTemplate,
): Line {
  const name = partOf("name", resource.name);
  const endpointLines = endpointLinesOf(resource.endpoint);
  const fields = [name, ...endpointLines];

  return groupOf(label, fields);
}

function httpLinesOf(http: HttpTemplate): readonly Line[] {
  return [
    fieldOf("method", http.method),
    ...endpointLinesOf(http.endpoint),
    fieldOf("headers", http.headers),
    fieldOf("body", http.body),
    fieldOf("query", http.query),
    labelledOf("output", http.output),
  ];
}

function openApiLinesOf(call: OpenApiTemplate): readonly Line[] {
  return [
    resourceLineOf("document", call.document),
    labelledOf("operationId", call.operationId),
    fieldOf("parameters", call.parameters),
    authenticationLineOf(call.authentication),
    labelledOf("output", call.output),
  ];
}

function grpcLinesOf(call: GrpcTemplate): readonly Line[] {
  const service = call.service;
  const location = labelledOf("host", service.host);
  return [
    resourceLineOf("proto", call.proto),
    labelledOf("service", service.name),
    location,
    partOf("port", service.port),
    authenticationLineOf(service.authentication),
    labelledOf("method", call.method),
    fieldOf("arguments", call.arguments),
  ];
}

function targetText(target: AsyncApiTarget): string {
  switch (target.kind) {
    case "channel":
      return `channel ${target.channel}`;
    case "operation":
      return `operation ${target.operation}`;
  }
}

function serverLineOf(server: AsyncApiServerTemplate): Line {
  switch (server.kind) {
    case "default":
      return leafOf("server default");
    case "named": {
      const variables = fieldOf("variables", server.variables);
      return groupOf(`server ${server.name}`, [variables]);
    }
  }
}

function protocolText(protocol: AsyncApiProtocolChoice): string {
  switch (protocol.kind) {
    case "default":
      return "default";
    case "named":
      return protocol.protocol;
  }
}

export function asyncApiRequestLinesOf(
  request: AsyncApiRequestTemplate,
): readonly Line[] {
  const target = targetText(request.target);
  const protocol = protocolText(request.protocol);

  return [
    resourceLineOf("document", request.document),
    labelledOf("target", target),
    serverLineOf(request.server),
    labelledOf("protocol", protocol),
    authenticationLineOf(request.authentication),
  ];
}

function asyncApiLinesOf(publish: AsyncApiPublishTemplate): readonly Line[] {
  return [
    ...asyncApiRequestLinesOf(publish),
    fieldOf("payload", publish.payload),
    fieldOf("headers", publish.headers),
  ];
}

function a2aLinesOf(call: A2aTemplate): readonly Line[] {
  const agent = call.agent;
  const target = agentLineOf(agent);
  return [
    labelledOf("method", call.method),
    target,
    fieldOf("parameters", call.parameters),
  ];
}

function agentLineOf(agent: A2aTemplate["agent"]): Line {
  switch (agent.kind) {
    case "agentCard":
      return resourceLineOf("agentCard", agent.resource);
    case "server": {
      const endpointLines = endpointLinesOf(agent.endpoint);
      return lineOf("server", endpointLines);
    }
  }
}

function optionsLinesOf(
  options: Readonly<Record<string, string>>,
): readonly Line[] {
  const written = Object.entries(options);

  return written.map(([name, value]) => labelledOf(`option ${name}`, value));
}

function transportLineOf(transport: McpTemplate["transport"]): Line {
  switch (transport.kind) {
    case "http": {
      const fields = [
        ...endpointLinesOf(transport.endpoint),
        fieldOf("headers", transport.headers),
        ...optionsLinesOf(transport.options),
      ];
      return lineOf("transport http", fields);
    }
    case "stdio": {
      const fields = [
        fieldOf("command", transport.command),
        fieldOf("arguments", transport.arguments),
        fieldOf("environment", transport.environment),
        ...optionsLinesOf(transport.options),
      ];
      return lineOf("transport stdio", fields);
    }
  }
}

function mcpLinesOf(call: McpTemplate): readonly Line[] {
  const client = clientText(call.client);

  return [
    labelledOf("protocolVersion", call.protocolVersion),
    labelledOf("method", call.method),
    fieldOf("parameters", call.parameters),
    transportLineOf(call.transport),
    leafOf(client),
  ];
}

function clientText(client: McpTemplate["client"]): string {
  switch (client.kind) {
    case "anonymous":
      return "client anonymous";
    case "named":
      return `client ${client.name} ${client.version}`;
  }
}

function emitLinesOf(emit: EmitTemplate): readonly Line[] {
  return emit.attributes.map(attributeLineOf);
}

function attributeLineOf(attribute: AttributeTemplate): Line {
  const text = attributeValueText(attribute.value);
  return labelledOf(attribute.name, text);
}

function attributeValueText(value: AttributeValue): string {
  switch (value.kind) {
    case "evaluated":
      return templateText(value.template);
    case "uri":
      return uriTemplateText(value);
    case "derivedId":
      return "derived";
    case "stepTime":
      return "now";
  }
}

function containerLineOf(container: ContainerTemplate): Line {
  const lifetime = lifetimeText(container.lifetime);
  const fields = [
    fieldOf("image", container.image),
    partOf("name", container.name),
    partOf("command", container.command),
    fieldOf("ports", container.ports),
    fieldOf("volumes", container.volumes),
    fieldOf("environment", container.environment),
    partOf("stdin", container.stdin),
    fieldOf("arguments", container.arguments),
    leafOf(lifetime),
    labelledOf("pullPolicy", container.pullPolicy),
  ];

  return lineOf("container", fields);
}

function lifetimeText(lifetime: ContainerTemplate["lifetime"]): string {
  switch (lifetime.kind) {
    case "always":
    case "never":
      return `lifetime ${lifetime.kind}`;
    case "eventually":
      return `lifetime eventually ${durationText(lifetime.after)}`;
  }
}

function scriptSourceLineOf(source: ScriptTemplate["source"]): Line {
  switch (source.kind) {
    case "inline": {
      const code = JSON.stringify(source.code);
      return labelledOf("code", code);
    }
    case "resource":
      return resourceLineOf("source", source);
  }
}

function scriptLineOf(script: ScriptTemplate): Line {
  const fields = [
    scriptSourceLineOf(script.source),
    partOf("stdin", script.stdin),
    fieldOf("arguments", script.arguments),
    fieldOf("environment", script.environment),
  ];

  return lineOf(`script ${script.language}`, fields);
}

function shellLineOf(shell: ShellTemplate): Line {
  const fields = [
    fieldOf("command", shell.command),
    partOf("stdin", shell.stdin),
    fieldOf("arguments", shell.arguments),
    partOf("directory", shell.directory),
    fieldOf("environment", shell.environment),
  ];

  return lineOf("shell", fields);
}

function processLinesOf(run: ProcessTemplate): readonly Line[] {
  const process = processLineOf(run.process);
  const awaited = String(run.await);

  return [process, labelledOf("await", awaited)];
}

function processLineOf(process: ProcessTemplate["process"]): Line {
  switch (process.kind) {
    case "container":
      return containerLineOf(process);
    case "script":
      return scriptLineOf(process);
    case "shell":
      return shellLineOf(process);
  }
}

function remoteLinesOf(
  effect:
    HttpTemplate | OpenApiTemplate | GrpcTemplate | AsyncApiPublishTemplate,
): readonly Line[] {
  switch (effect.kind) {
    case "http":
      return httpLinesOf(effect);
    case "openapi":
      return openApiLinesOf(effect);
    case "grpc":
      return grpcLinesOf(effect);
    case "asyncapi":
      return asyncApiLinesOf(effect);
  }
}

function localLinesOf(
  effect: EmitTemplate | TimerTemplate | ProcessTemplate | WorkflowTemplate,
): readonly Line[] {
  switch (effect.kind) {
    case "emit":
      return emitLinesOf(effect);
    case "timer": {
      const duration = durationText(effect.duration);
      return [labelledOf("duration", duration)];
    }
    case "process":
      return processLinesOf(effect);
    case "workflow": {
      const target = `${effect.namespace}/${effect.name}:${effect.version}`;
      const awaited = String(effect.await);

      return [
        labelledOf("workflow", target),
        fieldOf("input", effect.input),
        labelledOf("await", awaited),
      ];
    }
  }
}

export function effectLinesOf(effect: EffectTemplate): readonly Line[] {
  switch (effect.kind) {
    case "http":
    case "openapi":
    case "grpc":
    case "asyncapi":
      return remoteLinesOf(effect);
    case "a2a":
      return a2aLinesOf(effect);
    case "mcp":
      return mcpLinesOf(effect);
    case "emit":
    case "timer":
    case "process":
    case "workflow":
      return localLinesOf(effect);
    case "resource":
      return [partOf("name", effect.name), ...endpointLinesOf(effect.endpoint)];
  }
}

export function decoderText(decoder: Decoder): string {
  switch (decoder.kind) {
    case "input":
    case "sent":
      return `${decoder.kind} ${decoder.awaits}`;
    case "grpc":
      return decoder.kind;
    case "http":
      return httpDecoderText(decoder);
    case "a2a":
    case "mcp":
      return `${decoder.kind} ${decoder.method}`;
    case "process":
    case "workflow":
      return `${decoder.kind} ${decoder.return}`;
  }
}

function httpDecoderText(decoder: HttpDecoder): string {
  const text = `http ${decoder.output}`;

  if (!decoder.redirect) {
    return text;
  }

  return `${text} redirect`;
}
