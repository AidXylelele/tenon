import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { SecretRefusal } from "../../../domain/automation/secrets/enums.js";
import { Secret } from "../../../domain/automation/secrets/secret.js";
import type { CreateSecretResult, SecretValueCommand } from "./interfaces.js";
import { SecretRepository } from "./ports.js";

@Injectable()
export class CreateSecret {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: SecretValueCommand): Promise<CreateSecretResult> {
    const now = new Date();
    const existing = await this.secrets.find(command.ownerId, command.name);

    if (existing !== null)
      return { ok: false, failure: SecretRefusal.NameTaken };

    const created = Secret.create({
      ownerId: command.ownerId,
      name: command.name,
      value: command.value,
      now,
    });

    if (!created.ok) return created;

    const secret = created.value;
    await this.unitOfWork.run(() => this.secrets.save(secret));
    const view = {
      name: secret.name,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    };
    return { ok: true, value: view };
  }
}
