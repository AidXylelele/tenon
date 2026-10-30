import { Injectable } from '@nestjs/common';
import { DefinitionReader } from '../../application/automation/language/ports.js';
import type { Definition } from '../../domain/automation/language/definition.js';
import { InvalidDocumentError } from '../../domain/errors.js';
import { DslOutcomeKind } from './enums.js';
import { OpenWorkflowClient } from './interfaces.js';
import { DefinitionMapper } from './mappers/definition.mapper.js';

@Injectable()
export class OpenWorkflowDefinitionReader implements DefinitionReader {
  constructor(private readonly client: OpenWorkflowClient) {}

  read(text: string): Definition {
    const outcome = this.client.parse(text);

    if (outcome.kind === DslOutcomeKind.Failure)
      throw new InvalidDocumentError(outcome.pointer, outcome.failure);

    return DefinitionMapper.toDomain(outcome.workflow);
  }
}
