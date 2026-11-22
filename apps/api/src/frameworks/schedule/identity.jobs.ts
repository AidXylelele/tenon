import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WithoutOverlapping } from "@nestjs/locks";
import { Timeout } from "@nestjs/schedule";
import { SeedAdministrator } from "../../application/identity/seed-administrator.js";
import type { Env } from "../di/env.schema.js";

@Injectable()
export class IdentityJobs {
  constructor(
    private readonly seedAdministrator: SeedAdministrator,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Timeout(0)
  @WithoutOverlapping({ key: "identity:administrator" })
  seedFirstAdministrator(): Promise<void> {
    const email = this.config.get("ADMIN_EMAIL", { infer: true });
    return this.seedAdministrator.execute({ email });
  }
}
