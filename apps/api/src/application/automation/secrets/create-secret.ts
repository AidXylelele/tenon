import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SecretRefusal } from '../../../domain/automation/secrets/enums.js';
import { Secret } from '../../../domain/automation/secrets/secret.js';
import { Clock } from '../ports.js';
import {
  type CreateSecretResult,
  SecretRepository,
  type SecretValueCommand,
} from './ports.js';

@Injectable()
export class CreateSecret {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: SecretValueCommand): Promise<CreateSecretResult> {
    const now = this.clock.now();
    const existing = await this.secrets.find(command.ownerId, command.name);

    if (existing !== null)
      return { ok: false, failure: SecretRefusal.NameTaken };

    const secret = Secret.create({
      ownerId: command.ownerId,
      name: command.name,
      value: command.value,
      now,
    });
    await this.secrets.save(secret);
    return { ok: true, value: secret };
  }
}
