import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DefinitionReader } from '../../../application/automation/language/ports.js';
import type { Definition } from '../../../domain/automation/language/definition.js';
import { InvalidDocumentError } from '../../../domain/errors.js';
import { DslOutcomeKind } from './enums.js';
import { OpenWorkflowClient } from './interfaces.js';
import { DefinitionMapper } from './mappers/definition.mapper.js';

@Injectable()
export class OpenWorkflowDefinitionReader implements DefinitionReader {
  private static readonly ROOT = '';
  private static readonly OUT_OF_TIME =
    'The document could not be read in time';
  private static readonly OUT_OF_MEMORY =
    'The document needs more memory than a document may use';
  // A published text never changes and a Definition is immutable, so the rounds of a version's
  // instances read it from here instead of parsing and mapping it again. The least recently read
  // goes first, so drafts under check do not push out the versions that run.
  private static readonly CACHED = 64;
  private static readonly DIGEST = 'sha256';

  private readonly definitions = new Map<string, Definition>();

  constructor(private readonly client: OpenWorkflowClient) {}

  async read(text: string): Promise<Definition> {
    const key = createHash(OpenWorkflowDefinitionReader.DIGEST)
      .update(text)
      .digest('hex');
    const cached = this.definitions.get(key);

    if (cached !== undefined) {
      this.definitions.delete(key);
      this.definitions.set(key, cached);
      return cached;
    }

    const outcome = await this.client.parse(text);

    if (outcome.kind === DslOutcomeKind.Failure)
      throw new InvalidDocumentError(outcome.pointer, outcome.failure);

    if (outcome.kind === DslOutcomeKind.TimedOut)
      throw new InvalidDocumentError(
        OpenWorkflowDefinitionReader.ROOT,
        OpenWorkflowDefinitionReader.OUT_OF_TIME,
      );

    if (outcome.kind === DslOutcomeKind.Exhausted)
      throw new InvalidDocumentError(
        OpenWorkflowDefinitionReader.ROOT,
        OpenWorkflowDefinitionReader.OUT_OF_MEMORY,
      );

    const definition = DefinitionMapper.toDomain(
      outcome.workflow,
      outcome.document,
    );
    this.#remember(key, definition);
    return definition;
  }

  #remember(key: string, definition: Definition): void {
    this.definitions.set(key, definition);

    if (this.definitions.size <= OpenWorkflowDefinitionReader.CACHED) return;

    const [oldest] = this.definitions.keys();

    if (oldest !== undefined) this.definitions.delete(oldest);
  }
}
