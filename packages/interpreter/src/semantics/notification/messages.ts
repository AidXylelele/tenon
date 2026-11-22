import {
  defaults,
  dslVersions,
  scriptLanguages,
} from "../../standard/index.js";
import type {
  Finding,
  MessageDetails,
  MessageName,
} from "../../syntax/index.js";

export type Root = "document" | "filter";

type Texts = {
  readonly [Name in MessageName]: (
    ...parts: readonly [...MessageDetails[Name], rootName: string]
  ) => string;
};

const rootNames: Readonly<Record<Root, string>> = {
  document: "The document",
  filter: "The filter",
};

const supportedDsl = dslVersions.map((line) => `${line}.x`).join(" or ");

const allowedLanguages = scriptLanguages.join(", ");

const texts: Texts = {
  unparsable: (problem) => problem,
  expanding: () => "The document expands beyond its size.",
  selfAlias: () => "An alias must not refer to a value that contains it.",
  complexKey: () => "A key must be a scalar.",
  notJson: () => "The value is not a JSON value.",
  tooDeep: (limit, rootName) =>
    `${rootName} is nested deeper than ${limit} levels.`,
  schema: (problem) => problem,
  unnamedAgent: () => "An A2A call names its agent by agentCard or by server.",
  eventWithoutProperties: () =>
    "The event must name its properties under with.",
  unsupportedLanguage: () => `Language must be one of ${allowedLanguages}.`,
  competitionWithoutBranches: () =>
    "A competing fork must have at least 1 branch.",
  correlatedFilter: () =>
    "A filter outside a run must not correlate: it keeps no expectation between events.",
  dslVersion: (dsl) =>
    `DSL version '${dsl}' is not supported: expected ${supportedDsl}.`,
  expressionLanguage: (language) =>
    `Expression language '${language}' is not supported: expected ${defaults.expressionLanguage}.`,
  invalidExpression: (source, problem) =>
    `Expression '${source}' does not compile: ${problem}`,
  unknownVariable: (variable) => `Variable '${variable}' is not in scope here.`,
  duplicateBinder: (variable) =>
    `Variable '${variable}' names both the item and its index: each needs its own name.`,
  duplicateTask: (name) => `Task name '${name}' is already used in this list.`,
  unknownTask: (name) => `Task '${name}' is not declared in this list.`,
  branchJump: (name) =>
    `A branch cannot jump to '${name}', a task of another branch.`,
  duplicateDefault: () => "A switch can have only one case without 'when'.",
  undeclaredFunction: (name) =>
    `Function '${name}' is not declared in use.functions.`,
  undeclaredError: (name) => `Error '${name}' is not declared in use.errors.`,
  undeclaredRetry: (name) =>
    `Retry policy '${name}' is not declared in use.retries.`,
  undeclaredTimeout: (name) =>
    `Timeout '${name}' is not declared in use.timeouts.`,
  undeclaredAuthentication: (name) =>
    `Authentication '${name}' is not declared in use.authentications.`,
  undeclaredCatalog: (name) =>
    `Catalog '${name}' is not declared in use.catalogs.`,
  undeclaredSecret: (name) =>
    `Secret '${name}' is not declared in use.secrets.`,
  unknownSecret: (name) => `Secret '${name}' is not held by the host.`,
  misnamedAttribute: (name) =>
    `Event attribute '${name}' must be named in lower-case letters and digits.`,
  emptyEventAttribute: (name) => `Event attribute '${name}' must not be empty.`,
  emptyFilterAttribute: (name) =>
    `An event filter on an empty '${name}' matches no event.`,
  emptyImage: () => "A container must name its image.",
  emptyMethod: () => "An HTTP call must name its method.",
  emptyWorkflowIdentity: (member) =>
    `The workflow to run must have a ${member}.`,
  invalidDuration: (text) => `Duration '${text}' is not an ISO 8601 duration.`,
  dynamicSchedule: (text) => `Schedule duration '${text}' must be a literal.`,
  calendarSchedule: (text) =>
    `Schedule duration '${text}' must have a fixed length: no years, months or weeks.`,
  calendarLifetime: (text) =>
    `Container lifetime '${text}' must have a fixed length: no years, months or weeks.`,
  invalidCron: (cron) =>
    `Cron expression '${cron}' must have five valid fields.`,
  invalidRegex: (pattern) =>
    `Event filter attribute '${pattern}' is not a valid regular expression.`,
  schemaFormat: (format) =>
    `Schema format '${format}' is not supported: expected json.`,
  invalidSchema: (problem) => `The schema does not compile: ${problem}`,
  invalidImportedSchema: (reference, problem) =>
    `Schema '${reference}' does not compile: ${problem}`,
  unresolvedImport: (reference) =>
    `Import '${reference}' has not been fetched.`,
  importNotTask: (reference) => `Import '${reference}' is not a valid task.`,
  importNotSchema: (reference) =>
    `Import '${reference}' is not a valid schema.`,
  dynamicCatalog: () => "A catalog endpoint must be a literal URI.",
  recursiveFunction: (name) => `Function '${name}' reaches itself.`,
  capability: (capability) => `The host does not provide '${capability}'.`,
};

export function messageOf<Name extends MessageName>(
  finding: Finding<Name>,
  root: Root,
): string {
  const text: Texts[Name] = texts[finding.name];
  const rootName = rootNames[root];

  return text(...finding.details, rootName);
}
