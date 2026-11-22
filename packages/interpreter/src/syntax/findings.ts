import type { DiagnosticCode, Import } from "../api/index.js";

export interface MessageDetails {
  readonly unparsable: readonly [problem: string];
  readonly expanding: readonly [];
  readonly selfAlias: readonly [];
  readonly complexKey: readonly [];
  readonly notJson: readonly [];
  readonly tooDeep: readonly [limit: string];
  readonly schema: readonly [problem: string];
  readonly unnamedAgent: readonly [];
  readonly eventWithoutProperties: readonly [];
  readonly unsupportedLanguage: readonly [];
  readonly competitionWithoutBranches: readonly [];
  readonly correlatedFilter: readonly [];
  readonly dslVersion: readonly [dsl: string];
  readonly expressionLanguage: readonly [language: string];
  readonly invalidExpression: readonly [source: string, problem: string];
  readonly unknownVariable: readonly [variable: string];
  readonly duplicateBinder: readonly [variable: string];
  readonly duplicateTask: readonly [name: string];
  readonly unknownTask: readonly [name: string];
  readonly branchJump: readonly [name: string];
  readonly duplicateDefault: readonly [];
  readonly undeclaredFunction: readonly [name: string];
  readonly undeclaredError: readonly [name: string];
  readonly undeclaredRetry: readonly [name: string];
  readonly undeclaredTimeout: readonly [name: string];
  readonly undeclaredAuthentication: readonly [name: string];
  readonly undeclaredCatalog: readonly [name: string];
  readonly undeclaredSecret: readonly [name: string];
  readonly unknownSecret: readonly [name: string];
  readonly misnamedAttribute: readonly [name: string];
  readonly emptyEventAttribute: readonly [name: string];
  readonly emptyFilterAttribute: readonly [name: string];
  readonly emptyImage: readonly [];
  readonly emptyMethod: readonly [];
  readonly emptyGrpcMember: readonly [member: string];
  readonly emptyOperation: readonly [];
  readonly emptyAsyncApiTarget: readonly [target: string];
  readonly emptyWorkflowIdentity: readonly [member: string];
  readonly invalidDuration: readonly [text: string];
  readonly dynamicSchedule: readonly [text: string];
  readonly calendarSchedule: readonly [text: string];
  readonly calendarLifetime: readonly [text: string];
  readonly invalidCron: readonly [cron: string];
  readonly invalidRegex: readonly [pattern: string];
  readonly schemaFormat: readonly [format: string];
  readonly invalidSchema: readonly [problem: string];
  readonly invalidImportedSchema: readonly [reference: string, problem: string];
  readonly unresolvedImport: readonly [reference: string];
  readonly importNotTask: readonly [reference: string];
  readonly importNotSchema: readonly [reference: string];
  readonly dynamicCatalog: readonly [];
  readonly recursiveFunction: readonly [name: string];
  readonly capability: readonly [capability: string];
}

export type MessageName = keyof MessageDetails;

export interface Finding<Name extends MessageName = MessageName> {
  readonly name: Name;
  readonly code: DiagnosticCode;
  readonly pointer: string;
  readonly subject: string | null;
  readonly details: MessageDetails[Name];
  readonly import: Import | null;
}
