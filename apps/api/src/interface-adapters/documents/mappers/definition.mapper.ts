import {
  InvalidDocumentError,
  UnsupportedConstructError,
} from '../../../domain/errors.js';
import { Definition } from '../../../domain/automation/language/definition.js';
import {
  DslVersion,
  UnsupportedConstruct,
} from '../../../domain/automation/language/enums.js';
import type { JsonObject } from '../../../domain/automation/language/interfaces.js';
import { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import { EvaluationMode, ExpressionLanguage } from '../enums.js';
import type * as Dsl from '../interfaces.js';
import { KnownPropertiesMapper } from './known-properties.mapper.js';
import { InputMapper } from './input.mapper.js';
import { OutputMapper } from './output.mapper.js';
import { ReferenceableTimeoutMapper } from './referenceable-timeout.mapper.js';
import { ReusableComponentsMapper } from './reusable-components.mapper.js';
import { TaskListMapper } from './task-list.mapper.js';

export class DefinitionMapper {
  static readonly #PROPERTIES: readonly string[] = [
    'document',
    'input',
    'use',
    'do',
    'timeout',
    'output',
    'schedule',
    'evaluate',
  ];

  static readonly #EVALUATE: readonly string[] = ['mode', 'language'];
  static readonly #SECRETS = /\$secrets\b/;

  static toDomain(node: Dsl.Workflow, source: JsonObject): Definition {
    const root = JsonPointer.root();
    KnownPropertiesMapper.confirm(source, DefinitionMapper.#PROPERTIES, root);

    if (node.schedule !== undefined) {
      const scheduleAt = root.at('schedule');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.Schedule,
        scheduleAt,
      );
    }

    const document = node.document;
    const versions = Object.values(DslVersion);
    const dslVersion = versions.find((value: string) => value === document.dsl);

    if (dslVersion === undefined) {
      const dslAt = root.at('document').at('dsl');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.OtherDslVersion,
        dslAt,
      );
    }

    const evaluateAt = root.at('evaluate');
    const evaluate = node.evaluate ?? {};
    const object = typeof evaluate === 'object';

    if (!object || Array.isArray(evaluate)) {
      const evaluatePointer = evaluateAt.toString();
      throw new InvalidDocumentError(evaluatePointer, 'must be object');
    }

    KnownPropertiesMapper.confirm(
      evaluate,
      DefinitionMapper.#EVALUATE,
      evaluateAt,
    );
    const strict: string = EvaluationMode.Strict;
    const mode = evaluate.mode ?? strict;
    const modeAt = evaluateAt.at('mode');

    if (typeof mode !== 'string') {
      const modePointer = modeAt.toString();
      throw new InvalidDocumentError(modePointer, 'must be string');
    }

    if (mode !== strict) {
      throw new UnsupportedConstructError(
        UnsupportedConstruct.LooseEvaluation,
        modeAt,
      );
    }

    const jq: string = ExpressionLanguage.Jq;
    const language = evaluate.language ?? jq;
    const languageAt = evaluateAt.at('language');

    if (typeof language !== 'string') {
      const languagePointer = languageAt.toString();
      throw new InvalidDocumentError(languagePointer, 'must be string');
    }

    if (language !== jq) {
      throw new UnsupportedConstructError(
        UnsupportedConstruct.ExpressionLanguage,
        languageAt,
      );
    }

    const useAt = root.at('use');
    const components = ReusableComponentsMapper.toDomain(node.use, useAt);
    const workflow = new WorkflowName(document.namespace, document.name);
    const inputAt = root.at('input');
    const input = InputMapper.toDomain(node.input, inputAt);
    const outputAt = root.at('output');
    const output = OutputMapper.toDomain(node.output, outputAt);
    const timeoutAt = root.at('timeout');
    const timeout = ReferenceableTimeoutMapper.toDomain(
      node.timeout,
      timeoutAt,
      components,
    );
    const bodyAt = root.at('do');
    const body = TaskListMapper.toDomain(node.do, bodyAt, components);
    const definition = new Definition({
      document: source,
      workflow,
      version: document.version,
      dslVersion,
      input,
      output,
      timeout,
      body,
      components,
    });

    for (const expression of definition.expressions) {
      const secret = DefinitionMapper.#SECRETS.test(expression.program);

      if (secret)
        throw new UnsupportedConstructError(
          UnsupportedConstruct.SecretsArgument,
          expression.pointer,
        );
    }

    return definition;
  }
}
