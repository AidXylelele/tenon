import { Can } from '@nestjs/authorization';
import { Controller, Get, Module } from '@nestjs/common';
import { InvitationPolicy } from '../../src/application/policies/invitation.policy.js';

@Controller('probe')
export class ProbeController {
  @Get('user')
  @Can.Anyone()
  user() {
    return { ok: true };
  }

  @Get('admin')
  @Can(InvitationPolicy, 'manage')
  admin() {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
export class ProbeModule {}
