import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Missing } from "../enums.js";
import type { ReplaceSecretResult, SecretValueCommand } from "./interfaces.js";
import { SecretRepository } from "./ports.js";

@Injectable()
export class ReplaceSecret {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: SecretValueCommand): Promise<ReplaceSecretResult> {
    const now = new Date();
    const secret = await this.secrets.find(command.ownerId, command.name);

    if (secret === null) return { ok: false, failure: Missing.Secret };

    const replaced = secret.replace(command.value, now);

    if (!replaced.ok) return replaced;

    await this.unitOfWork.run(() => this.secrets.save(secret));
    return replaced;
  }
}
