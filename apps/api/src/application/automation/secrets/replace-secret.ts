import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';
import { Clock } from '../ports.js';
import {
  SecretRepository,
  type SecretResult,
  type SecretValueCommand,
} from './ports.js';

@Injectable()
export class ReplaceSecret {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: SecretValueCommand): Promise<SecretResult> {
    const now = this.clock.now();
    const secret = await this.secrets.find(command.ownerId, command.name);

    if (secret === null) return { ok: false, failure: Missing.Secret };

    secret.replace(command.value, now);
    await this.secrets.save(secret);
    return { ok: true, value: undefined };
  }
}
