import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Missing } from "../enums.js";
import type { SecretCommand, SecretResult } from "./interfaces.js";
import { SecretRepository } from "./ports.js";

@Injectable()
export class DeleteSecret {
  constructor(private readonly secrets: SecretRepository) {}

  @Transactional()
  async execute(command: SecretCommand): Promise<SecretResult> {
    const secret = await this.secrets.find(command.ownerId, command.name);

    if (secret === null) return { ok: false, failure: Missing.Secret };

    await this.secrets.remove(secret);
    return { ok: true, value: undefined };
  }
}
