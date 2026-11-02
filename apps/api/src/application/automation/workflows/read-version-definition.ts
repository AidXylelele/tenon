import { Injectable } from '@nestjs/common';
import type { Definition } from '../../../domain/automation/language/definition.js';
import { VersionNotFoundError } from '../../../domain/errors.js';
import { DefinitionReader } from '../language/ports.js';
import { VersionDocuments } from './queries.js';

@Injectable()
export class ReadVersionDefinition {
  constructor(
    private readonly documents: VersionDocuments,
    private readonly definitions: DefinitionReader,
  ) {}

  async execute(versionId: string): Promise<Definition> {
    const document = await this.documents.documentOf(versionId);

    if (document === null) throw new VersionNotFoundError();

    return this.definitions.read(document.text);
  }
}
