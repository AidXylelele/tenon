import type {
  ActivationAccess,
  ArgumentMeaning,
  ArrayTemplate,
  BinderMeaning,
  CalendarDuration,
  CompiledSchema,
  ComputedDuration,
  CurrentValue,
  Expression,
  FetchedSchema,
  FixedDuration,
  Literal,
  ObjectTemplate,
  OmittedPart,
  RunAccess,
  SecretsAccess,
  SlotAccess,
  StoreAccess,
  StoredContext,
  UriTemplateTerm,
  WrittenPart,
} from "./values.js";
import type { Flow, Jump } from "./directives.js";
import type {
  ActivationTarget,
  Choose,
  Deadline,
  Export,
  Extend,
  Extension,
  Guard,
  Handle,
  Invoke,
  Let,
  Loop,
  Parallel,
  Perform,
  Procedure,
  Raise,
  Sequence,
  SlotTarget,
  Stream,
  TaskList,
  TaskTerm,
  Transform,
  UncheckedExport,
  Validate,
} from "./terms.js";
import type {
  CountedAttempts,
  ExceptWhenTest,
  JitterRange,
  MatchTest,
  NoDelay,
  NoJitter,
  NoRetry,
  Recover,
  Reraise,
  RetryPolicy,
  UnboundedAttempts,
  UnlimitedDuration,
  WhenTest,
  WithinDuration,
} from "./handling.js";
import type {
  AllStrategy,
  AnyStrategy,
  ClosesAfter,
  ConditionTest,
  ConditionalVerdict,
  EqualsTest,
  Expected,
  FailedVerdict,
  FilterAt,
  FilterTemplate,
  FirstSeen,
  HeldVerdict,
  ListenSource,
  NothingBelow,
  OneStrategy,
  OpenWindow,
  PatternTest,
  StopAmount,
  StopConsumption,
  StopUntil,
  StopWhile,
  SubscriptionSource,
  UntilCondition,
  UntilFirst,
  UntilStrategy,
} from "./streams.js";
import type {
  AfterSchedule,
  CronSchedule,
  EventSchedule,
  EverySchedule,
} from "../../api/index.js";
import type {
  A2aDecoder,
  A2aTemplate,
  AgentCardTemplate,
  AgentServerTemplate,
  AlwaysCleanup,
  AnonymousClient,
  AsyncApiPublishTemplate,
  AttributeTemplate,
  BasicTemplate,
  BearerTemplate,
  ChannelTarget,
  ContainerTemplate,
  DefaultProtocol,
  DefaultServer,
  DerivedIdValue,
  DigestTemplate,
  EmitTemplate,
  EvaluatedValue,
  EventualCleanup,
  GivenToken,
  GrpcDecoder,
  GrpcTemplate,
  HttpDecoder,
  HttpTemplate,
  InlineCodeTemplate,
  InputDecoder,
  McpDecoder,
  McpHttpTransport,
  McpStdioTransport,
  McpTemplate,
  NamedClient,
  NamedProtocol,
  NamedServer,
  NeverCleanup,
  NoAuthentication,
  NoToken,
  OAuth2Template,
  OidcTemplate,
  OpenApiTemplate,
  OperationTarget,
  ProcessDecoder,
  ProcessTemplate,
  ResourceTemplate,
  ScriptTemplate,
  SecretTemplate,
  SentDecoder,
  ShellTemplate,
  StepTimeValue,
  TimerTemplate,
  WorkflowDecoder,
  WorkflowTemplate,
} from "./effects.js";
import { uriTemplateOf } from "../../runtime/index.js";
import { constantObjectOf, constantOf, constantTextsOf } from "./constants.js";

type Parts<T> = Omit<T, "form" | "kind">;

export function slotAccess(parts: Parts<SlotAccess>): SlotAccess {
  return { kind: "slot", depth: parts.depth, index: parts.index };
}

export function activationAccess(
  parts: Parts<ActivationAccess>,
): ActivationAccess {
  return { kind: "activation", hops: parts.hops, field: parts.field };
}

export const storeAccess: StoreAccess = { kind: "store" };

export function runAccess(parts: Parts<RunAccess>): RunAccess {
  return { kind: "run", field: parts.field };
}

export const secretsAccess: SecretsAccess = { kind: "secrets" };

export function argumentMeaning(
  parts: Parts<ArgumentMeaning>,
): ArgumentMeaning {
  return { kind: "argument", argument: parts.argument };
}

export function binderMeaning(parts: Parts<BinderMeaning>): BinderMeaning {
  return { kind: "binder", declaration: parts.declaration, role: parts.role };
}

export function expression(parts: Parts<Expression>): Expression {
  return {
    kind: "expression",
    id: parts.id,
    source: parts.source,
    mode: parts.mode,
    arguments: parts.arguments,
  };
}

export function literal(parts: Parts<Literal>): Literal {
  const value = constantOf(parts.value);
  return { kind: "literal", value };
}

export function objectTemplate(parts: Parts<ObjectTemplate>): ObjectTemplate {
  return { kind: "object", fields: parts.fields };
}

export function arrayTemplate(parts: Parts<ArrayTemplate>): ArrayTemplate {
  return { kind: "array", items: parts.items };
}

export const currentValue: CurrentValue = { kind: "current" };

export const storedContext: StoredContext = { kind: "context" };

export function uriTemplateTerm(parts: {
  readonly source: string;
}): UriTemplateTerm {
  const template = uriTemplateOf(parts.source);
  return { kind: "uri", template };
}

export const omittedPart: OmittedPart = { kind: "omitted" };

export function writtenPart(parts: Parts<WrittenPart>): WrittenPart {
  return { kind: "written", template: parts.template };
}

export function fixedDuration(parts: Parts<FixedDuration>): FixedDuration {
  return { kind: "fixed", milliseconds: parts.milliseconds };
}

export function calendarDuration(
  parts: Parts<CalendarDuration>,
): CalendarDuration {
  return { kind: "calendar", iso: parts.iso };
}

export function computedDuration(
  parts: Parts<ComputedDuration>,
): ComputedDuration {
  return { kind: "computed", expression: parts.expression };
}

export function compiledSchema(parts: Parts<CompiledSchema>): CompiledSchema {
  return { kind: "compiled", id: parts.id };
}

export function fetchedSchema(parts: Parts<FetchedSchema>): FetchedSchema {
  return { kind: "fetched", id: parts.id, resource: parts.resource };
}

export const continueDirective: Flow<"continue"> = { kind: "continue" };

export const exitDirective: Flow<"exit"> = { kind: "exit" };

export const endDirective: Flow<"end"> = { kind: "end" };

export function jumpDirective(parts: Parts<Jump>): Jump {
  return { kind: "jump", index: parts.index, name: parts.name };
}

export function sequence(parts: Parts<Sequence>): Sequence {
  return { form: "sequence", id: parts.id, steps: parts.steps };
}

export function taskList(parts: Parts<TaskList>): TaskList {
  return {
    form: "taskList",
    id: parts.id,
    pointer: parts.pointer,
    tasks: parts.tasks,
  };
}

export function task(parts: Parts<TaskTerm>): TaskTerm {
  return {
    form: "task",
    id: parts.id,
    descriptor: parts.descriptor,
    then: parts.then,
    body: parts.body,
  };
}

export function slotTarget(parts: Parts<SlotTarget>): SlotTarget {
  return { kind: "slot", argument: parts.argument };
}

export function activationTarget(
  parts: Parts<ActivationTarget>,
): ActivationTarget {
  return { kind: "activation", field: parts.field };
}

export function binding(parts: Parts<Let>): Let {
  return { form: "let", id: parts.id, target: parts.target, body: parts.body };
}

export function guard(parts: Parts<Guard>): Guard {
  return {
    form: "guard",
    id: parts.id,
    conditions: parts.conditions,
    body: parts.body,
  };
}

export function transform(parts: Parts<Transform>): Transform {
  return { form: "transform", id: parts.id, value: parts.value };
}

export function validate(parts: Parts<Validate>): Validate {
  return { form: "validate", id: parts.id, schema: parts.schema };
}

export const uncheckedExport: UncheckedExport = { kind: "unchecked" };

export function exportTerm(parts: Parts<Export>): Export {
  return {
    form: "export",
    id: parts.id,
    value: parts.value,
    schema: parts.schema,
  };
}

export function choose(parts: Parts<Choose>): Choose {
  return { form: "choose", id: parts.id, cases: parts.cases };
}

export function loop(parts: Parts<Loop>): Loop {
  return {
    form: "loop",
    id: parts.id,
    items: parts.items,
    binders: parts.binders,
    conditions: parts.conditions,
    body: parts.body,
  };
}

export function perform(parts: Parts<Perform>): Perform {
  return {
    form: "perform",
    id: parts.id,
    effect: parts.effect,
    decoder: parts.decoder,
  };
}

export function raise(parts: Parts<Raise>): Raise {
  return { form: "raise", id: parts.id, error: parts.error };
}

export function handle(parts: Parts<Handle>): Handle {
  return {
    form: "handle",
    id: parts.id,
    body: parts.body,
    catch: parts.catch,
    retry: parts.retry,
  };
}

export function deadline(parts: Parts<Deadline>): Deadline {
  return {
    form: "deadline",
    id: parts.id,
    duration: parts.duration,
    body: parts.body,
  };
}

export function parallel(parts: Parts<Parallel>): Parallel {
  return {
    form: "parallel",
    id: parts.id,
    branches: parts.branches,
    join: parts.join,
  };
}

export function stream(parts: Parts<Stream>): Stream {
  return {
    form: "stream",
    id: parts.id,
    source: parts.source,
    stop: parts.stop,
    iterators: parts.iterators,
  };
}

export function extend(parts: Parts<Extend>): Extend {
  return {
    form: "extend",
    id: parts.id,
    extensions: parts.extensions,
    body: parts.body,
    stages: parts.stages,
  };
}

export function extension(parts: Parts<Extension>): Extension {
  return {
    id: parts.id,
    index: parts.index,
    conditions: parts.conditions,
    before: parts.before,
    after: parts.after,
  };
}

export function invoke(parts: Parts<Invoke>): Invoke {
  return {
    form: "invoke",
    id: parts.id,
    callee: parts.callee,
    arguments: parts.arguments,
  };
}

export function procedure(parts: Parts<Procedure>): Procedure {
  return { key: parts.key, name: parts.name, body: parts.body };
}

export function matchTest(parts: Parts<MatchTest>): MatchTest {
  const filter = constantObjectOf(parts.filter);
  return { kind: "match", filter };
}

export function whenTest(parts: Parts<WhenTest>): WhenTest {
  return { kind: "when", condition: parts.condition };
}

export function exceptWhenTest(parts: Parts<ExceptWhenTest>): ExceptWhenTest {
  return { kind: "exceptWhen", condition: parts.condition };
}

export function recover(parts: Parts<Recover>): Recover {
  return { kind: "recover", body: parts.body };
}

export const reraise: Reraise = { kind: "reraise" };

export const noRetry: NoRetry = { kind: "never" };

export const unboundedAttempts: UnboundedAttempts = { kind: "unbounded" };

export function countedAttempts(
  parts: Parts<CountedAttempts>,
): CountedAttempts {
  return { kind: "count", count: parts.count };
}

export const unlimitedDuration: UnlimitedDuration = { kind: "unlimited" };

export function withinDuration(parts: Parts<WithinDuration>): WithinDuration {
  return { kind: "within", duration: parts.duration };
}

export const noDelay: NoDelay = { kind: "noDelay" };

export const noJitter: NoJitter = { kind: "noJitter" };

export function jitterRange(parts: Parts<JitterRange>): JitterRange {
  return { kind: "range", from: parts.from, to: parts.to };
}

export function retryPolicy(parts: Parts<RetryPolicy>): RetryPolicy {
  return {
    kind: "policy",
    tests: parts.tests,
    delay: parts.delay,
    backoff: parts.backoff,
    attempts: parts.attempts,
    attempt: parts.attempt,
    duration: parts.duration,
    jitter: parts.jitter,
  };
}

export function expected(parts: Parts<Expected>): Expected {
  return { kind: "expected", value: parts.value };
}

export const firstSeen: FirstSeen = { kind: "firstSeen" };

export function patternTest(parts: Parts<PatternTest>): PatternTest {
  return { kind: "pattern", id: parts.id, pattern: parts.pattern };
}

export function equalsTest(parts: Parts<EqualsTest>): EqualsTest {
  const value = constantOf(parts.value);
  return { kind: "equals", value };
}

export function conditionTest(parts: Parts<ConditionTest>): ConditionTest {
  return { kind: "condition", condition: parts.condition };
}

export const heldVerdict: HeldVerdict = { kind: "held" };

export const failedVerdict: FailedVerdict = { kind: "failed" };

export function conditionalVerdict(
  parts: Parts<ConditionalVerdict>,
): ConditionalVerdict {
  return {
    kind: "conditional",
    condition: parts.condition,
    value: parts.value,
  };
}

export function filterTemplate(parts: Parts<FilterTemplate>): FilterTemplate {
  const position: FilterAt = { level: parts.at.level, filter: parts.at.filter };
  const at = Object.freeze(position);

  return { at, with: parts.with, correlate: parts.correlate };
}

export function oneStrategy(parts: Parts<OneStrategy>): OneStrategy {
  return { kind: "one", filter: parts.filter };
}

export function allStrategy(parts: Parts<AllStrategy>): AllStrategy {
  return { kind: "all", filters: parts.filters };
}

export const untilFirst: UntilFirst = { kind: "first" };

export function untilCondition(parts: Parts<UntilCondition>): UntilCondition {
  return { kind: "condition", condition: parts.condition };
}

export function untilStrategy(parts: Parts<UntilStrategy>): UntilStrategy {
  return { kind: "strategy", strategy: parts.strategy };
}

export function anyStrategy(parts: Parts<AnyStrategy>): AnyStrategy {
  return { kind: "any", filters: parts.filters, until: parts.until };
}

export const nothingBelow: NothingBelow = { kind: "none" };

export function listenSource(parts: Parts<ListenSource>): ListenSource {
  return { kind: "listen", strategy: parts.strategy, read: parts.read };
}

export function subscriptionSource(
  parts: Parts<SubscriptionSource>,
): SubscriptionSource {
  return {
    kind: "subscription",
    request: parts.request,
    filters: parts.filters,
  };
}

export const openWindow: OpenWindow = { kind: "open" };

export function closesAfter(parts: Parts<ClosesAfter>): ClosesAfter {
  return { kind: "closesAfter", duration: parts.duration };
}

export const stopConsumption: StopConsumption = { kind: "consumption" };

export function stopAmount(parts: Parts<StopAmount>): StopAmount {
  return { kind: "amount", amount: parts.amount, window: parts.window };
}

export function stopWhile(parts: Parts<StopWhile>): StopWhile {
  return { kind: "while", condition: parts.condition, window: parts.window };
}

export function stopUntil(parts: Parts<StopUntil>): StopUntil {
  return { kind: "until", condition: parts.condition, window: parts.window };
}

export const noAuthentication: NoAuthentication = { kind: "none" };

export function basicTemplate(parts: Parts<BasicTemplate>): BasicTemplate {
  return { kind: "basic", username: parts.username, password: parts.password };
}

export function bearerTemplate(parts: Parts<BearerTemplate>): BearerTemplate {
  return { kind: "bearer", token: parts.token };
}

export function digestTemplate(parts: Parts<DigestTemplate>): DigestTemplate {
  return { kind: "digest", username: parts.username, password: parts.password };
}

export const noToken: NoToken = { kind: "none" };

export function givenToken(parts: Parts<GivenToken>): GivenToken {
  return { kind: "given", token: parts.token, type: parts.type };
}

export function oAuth2Template(parts: Parts<OAuth2Template>): OAuth2Template {
  return {
    kind: "oauth2",
    endpoints: parts.endpoints,
    authority: parts.authority,
    grant: parts.grant,
    client: parts.client,
    encoding: parts.encoding,
    issuers: parts.issuers,
    scopes: parts.scopes,
    audiences: parts.audiences,
    username: parts.username,
    password: parts.password,
    subject: parts.subject,
    actor: parts.actor,
  };
}

export function oidcTemplate(parts: Parts<OidcTemplate>): OidcTemplate {
  return {
    kind: "oidc",
    authority: parts.authority,
    grant: parts.grant,
    client: parts.client,
    encoding: parts.encoding,
    issuers: parts.issuers,
    scopes: parts.scopes,
    audiences: parts.audiences,
    username: parts.username,
    password: parts.password,
    subject: parts.subject,
    actor: parts.actor,
  };
}

export function secretTemplate(parts: Parts<SecretTemplate>): SecretTemplate {
  return { kind: "secret", scheme: parts.scheme, secret: parts.secret };
}

export function resourceTemplate(
  parts: Parts<ResourceTemplate>,
): ResourceTemplate {
  return { kind: "resource", name: parts.name, endpoint: parts.endpoint };
}

export function httpTemplate(parts: Parts<HttpTemplate>): HttpTemplate {
  return {
    kind: "http",
    method: parts.method,
    endpoint: parts.endpoint,
    headers: parts.headers,
    body: parts.body,
    query: parts.query,
    output: parts.output,
  };
}

export function openApiTemplate(
  parts: Parts<OpenApiTemplate>,
): OpenApiTemplate {
  return {
    kind: "openapi",
    document: parts.document,
    operationId: parts.operationId,
    parameters: parts.parameters,
    authentication: parts.authentication,
    output: parts.output,
  };
}

export function grpcTemplate(parts: Parts<GrpcTemplate>): GrpcTemplate {
  return {
    kind: "grpc",
    proto: parts.proto,
    service: parts.service,
    method: parts.method,
    arguments: parts.arguments,
  };
}

export function channelTarget(parts: Parts<ChannelTarget>): ChannelTarget {
  return { kind: "channel", channel: parts.channel };
}

export function operationTarget(
  parts: Parts<OperationTarget>,
): OperationTarget {
  return { kind: "operation", operation: parts.operation };
}

export const defaultServer: DefaultServer = { kind: "default" };

export function namedServer(parts: Parts<NamedServer>): NamedServer {
  return { kind: "named", name: parts.name, variables: parts.variables };
}

export const defaultProtocol: DefaultProtocol = { kind: "default" };

export function namedProtocol(parts: Parts<NamedProtocol>): NamedProtocol {
  return { kind: "named", protocol: parts.protocol };
}

export function asyncApiPublishTemplate(
  parts: Parts<AsyncApiPublishTemplate>,
): AsyncApiPublishTemplate {
  return {
    kind: "asyncapi",
    payload: parts.payload,
    headers: parts.headers,
    document: parts.document,
    target: parts.target,
    server: parts.server,
    protocol: parts.protocol,
    authentication: parts.authentication,
  };
}

export function agentCardTemplate(
  parts: Parts<AgentCardTemplate>,
): AgentCardTemplate {
  return { kind: "agentCard", resource: parts.resource };
}

export function agentServerTemplate(
  parts: Parts<AgentServerTemplate>,
): AgentServerTemplate {
  return { kind: "server", endpoint: parts.endpoint };
}

export function a2aTemplate(parts: Parts<A2aTemplate>): A2aTemplate {
  return {
    kind: "a2a",
    method: parts.method,
    agent: parts.agent,
    parameters: parts.parameters,
  };
}

export function mcpHttpTransport(
  parts: Parts<McpHttpTransport>,
): McpHttpTransport {
  const options = constantTextsOf(parts.options);

  return {
    kind: "http",
    endpoint: parts.endpoint,
    headers: parts.headers,
    options,
  };
}

export function mcpStdioTransport(
  parts: Parts<McpStdioTransport>,
): McpStdioTransport {
  const options = constantTextsOf(parts.options);

  return {
    kind: "stdio",
    command: parts.command,
    arguments: parts.arguments,
    environment: parts.environment,
    options,
  };
}

export const anonymousClient: AnonymousClient = { kind: "anonymous" };

export function namedClient(parts: Parts<NamedClient>): NamedClient {
  return { kind: "named", name: parts.name, version: parts.version };
}

export function mcpTemplate(parts: Parts<McpTemplate>): McpTemplate {
  return {
    kind: "mcp",
    protocolVersion: parts.protocolVersion,
    method: parts.method,
    parameters: parts.parameters,
    transport: parts.transport,
    client: parts.client,
  };
}

export function evaluatedValue(parts: Parts<EvaluatedValue>): EvaluatedValue {
  return { kind: "evaluated", template: parts.template };
}

export const derivedIdValue: DerivedIdValue = { kind: "derivedId" };

export const stepTimeValue: StepTimeValue = { kind: "stepTime" };

export function attributeTemplate(
  parts: Parts<AttributeTemplate>,
): AttributeTemplate {
  return { name: parts.name, value: parts.value };
}

export function emitTemplate(parts: Parts<EmitTemplate>): EmitTemplate {
  return { kind: "emit", attributes: parts.attributes };
}

export function timerTemplate(parts: Parts<TimerTemplate>): TimerTemplate {
  return { kind: "timer", duration: parts.duration };
}

export const alwaysCleanup: AlwaysCleanup = { kind: "always" };

export const neverCleanup: NeverCleanup = { kind: "never" };

export function eventualCleanup(
  parts: Parts<EventualCleanup>,
): EventualCleanup {
  return { kind: "eventually", after: parts.after };
}

export function containerTemplate(
  parts: Parts<ContainerTemplate>,
): ContainerTemplate {
  return {
    kind: "container",
    image: parts.image,
    name: parts.name,
    command: parts.command,
    ports: parts.ports,
    volumes: parts.volumes,
    environment: parts.environment,
    stdin: parts.stdin,
    arguments: parts.arguments,
    lifetime: parts.lifetime,
    pullPolicy: parts.pullPolicy,
  };
}

export function inlineCodeTemplate(
  parts: Parts<InlineCodeTemplate>,
): InlineCodeTemplate {
  return { kind: "inline", code: parts.code };
}

export function scriptTemplate(parts: Parts<ScriptTemplate>): ScriptTemplate {
  return {
    kind: "script",
    language: parts.language,
    source: parts.source,
    stdin: parts.stdin,
    arguments: parts.arguments,
    environment: parts.environment,
  };
}

export function shellTemplate(parts: Parts<ShellTemplate>): ShellTemplate {
  return {
    kind: "shell",
    command: parts.command,
    stdin: parts.stdin,
    arguments: parts.arguments,
    directory: parts.directory,
    environment: parts.environment,
  };
}

export function processTemplate(
  parts: Parts<ProcessTemplate>,
): ProcessTemplate {
  return { kind: "process", process: parts.process, await: parts.await };
}

export function workflowTemplate(
  parts: Parts<WorkflowTemplate>,
): WorkflowTemplate {
  return {
    kind: "workflow",
    namespace: parts.namespace,
    name: parts.name,
    version: parts.version,
    input: parts.input,
    await: parts.await,
  };
}

export function inputDecoder(parts: Parts<InputDecoder>): InputDecoder {
  return { kind: "input", awaits: parts.awaits };
}

export function sentDecoder(parts: Parts<SentDecoder>): SentDecoder {
  return { kind: "sent", awaits: parts.awaits };
}

export function httpDecoder(parts: Parts<HttpDecoder>): HttpDecoder {
  return { kind: "http", output: parts.output, redirect: parts.redirect };
}

export const grpcDecoder: GrpcDecoder = { kind: "grpc" };

export function a2aDecoder(parts: Parts<A2aDecoder>): A2aDecoder {
  return { kind: "a2a", method: parts.method };
}

export function mcpDecoder(parts: Parts<McpDecoder>): McpDecoder {
  return { kind: "mcp", method: parts.method };
}

export function processDecoder(parts: Parts<ProcessDecoder>): ProcessDecoder {
  return { kind: "process", return: parts.return };
}

export function workflowDecoder(
  parts: Parts<WorkflowDecoder>,
): WorkflowDecoder {
  return { kind: "workflow", return: parts.return };
}

export function everySchedule(parts: Parts<EverySchedule>): EverySchedule {
  const schedule: EverySchedule = { kind: "every", interval: parts.interval };
  return Object.freeze(schedule);
}

export function cronSchedule(parts: Parts<CronSchedule>): CronSchedule {
  const schedule: CronSchedule = { kind: "cron", cron: parts.cron };
  return Object.freeze(schedule);
}

export function afterSchedule(parts: Parts<AfterSchedule>): AfterSchedule {
  const schedule: AfterSchedule = { kind: "after", delay: parts.delay };
  return Object.freeze(schedule);
}

export function eventSchedule(parts: Parts<EventSchedule>): EventSchedule {
  const types = Object.freeze([...parts.types]);
  const schedule: EventSchedule = { kind: "on", stream: parts.stream, types };
  return Object.freeze(schedule);
}
