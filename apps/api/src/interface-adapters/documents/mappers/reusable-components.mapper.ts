import { UnsupportedConstructError } from '../../../domain/errors.js';
import type { Authentication } from '../../../domain/automation/language/authentication.js';
import { UnsupportedConstruct } from '../../../domain/automation/language/enums.js';
import type { ExpressionDuration } from '../../../domain/automation/language/expression-duration.js';
import type { FixedDuration } from '../../../domain/automation/language/fixed-duration.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type { RetryStrategy } from '../../../domain/automation/language/retry-strategy.js';
import { ReusableComponents } from '../../../domain/automation/language/reusable-components.js';
import type { Task } from '../../../domain/automation/language/tasks/task.js';
import type { Template } from '../../../domain/automation/language/template.js';
import type * as Dsl from '../interfaces.js';
import { AuthenticationMapper } from './authentication.mapper.js';
import { DurationMapper } from './duration.mapper.js';
import { RetryStrategyMapper } from './retry-strategy.mapper.js';
import { TaskMapper } from './task.mapper.js';
import { TemplateMapper } from './template.mapper.js';

export class ReusableComponentsMapper {
  static toDomain(
    node: Dsl.Use | undefined,
    at: JsonPointer,
  ): ReusableComponents {
    if (node === undefined) return ReusableComponents.none();

    if (node.secrets !== undefined) {
      const secretsAt = at.at('secrets');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.Secrets,
        secretsAt,
      );
    }

    if (node.catalogs !== undefined) {
      const catalogsAt = at.at('catalogs');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.Catalogs,
        catalogsAt,
      );
    }

    if (node.extensions !== undefined) {
      const extensionsAt = at.at('extensions');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.Extensions,
        extensionsAt,
      );
    }

    const authenticationsAt = at.at('authentications');
    const declaredAuthentications = node.authentications ?? {};
    const authentications = new Map<string, Authentication>();

    for (const [name, policy] of Object.entries(declaredAuthentications)) {
      const policyAt = authenticationsAt.at(name);
      const authentication = AuthenticationMapper.toDomain(policy, policyAt);
      authentications.set(name, authentication);
    }

    const errorsAt = at.at('errors');
    const declaredErrors = node.errors ?? {};
    const errors = new Map<string, Template>();

    for (const [name, error] of Object.entries(declaredErrors)) {
      const errorAt = errorsAt.at(name);
      const template = TemplateMapper.toDomain(error, errorAt);
      errors.set(name, template);
    }

    const retriesAt = at.at('retries');
    const declaredRetries = node.retries ?? {};
    const retries = new Map<string, RetryStrategy>();

    for (const [name, policy] of Object.entries(declaredRetries)) {
      const policyAt = retriesAt.at(name);
      const retry = RetryStrategyMapper.toDomain(policy, policyAt);
      retries.set(name, retry);
    }

    const timeoutsAt = at.at('timeouts');
    const declaredTimeouts = node.timeouts ?? {};
    const timeouts = new Map<string, FixedDuration | ExpressionDuration>();

    for (const [name, timeout] of Object.entries(declaredTimeouts)) {
      const afterAt = timeoutsAt.at(name).at('after');
      const duration = DurationMapper.toDomain(timeout.after, afterAt);
      timeouts.set(name, duration);
    }

    const noFunctions = new Map<string, Task>();
    const lookups = new ReusableComponents({
      authentications,
      errors,
      retries,
      timeouts,
      functions: noFunctions,
    });
    const functionsAt = at.at('functions');
    const declaredFunctions = node.functions ?? {};
    const functions = new Map<string, Task>();

    for (const [name, task] of Object.entries(declaredFunctions)) {
      const functionAt = functionsAt.at(name);
      const declared = TaskMapper.toDomain(name, task, functionAt, lookups);
      functions.set(name, declared);
    }

    return new ReusableComponents({
      authentications,
      errors,
      retries,
      timeouts,
      functions,
    });
  }
}
