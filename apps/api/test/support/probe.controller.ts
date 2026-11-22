import { Public } from "@nestjs/authentication";
import { Can } from "@nestjs/authorization";
import { Controller, Get } from "@nestjs/common";
import { BulkheadFullError } from "@nestjs/resilience";
import { InvitationPolicy } from "../../src/interface-adapters/api/auth/invitation.policy.js";

@Controller("probe")
export class ProbeController {
  @Get("user")
  @Can.Anyone()
  user() {
    return { ok: true };
  }

  @Get("admin")
  @Can(InvitationPolicy, "manage")
  admin() {
    return { ok: true };
  }

  @Get("unmapped-error")
  @Public()
  unmappedError() {
    throw new Error("A rule without an HTTP mapping was broken");
  }

  @Get("full-pool")
  @Public()
  fullPool() {
    throw new BulkheadFullError("interpreter-checks", "full");
  }
}
