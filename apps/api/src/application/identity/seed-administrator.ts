import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Role } from "../../domain/identity/enums.js";
import { User } from "../../domain/identity/user.js";
import type { SeedAdministratorCommand } from "./interfaces.js";
import { UserRepository } from "./ports.js";

@Injectable()
export class SeedAdministrator {
  private static readonly NAME = "Administrator";

  constructor(private readonly users: UserRepository) {}

  @Transactional()
  async execute(command: SeedAdministratorCommand): Promise<void> {
    const seeded = await this.users.hasAdministrator();

    if (seeded) return;

    const administrator = User.create({
      email: command.email,
      name: SeedAdministrator.NAME,
      role: Role.Admin,
      now: new Date(),
    });
    await this.users.add(administrator);
  }
}
