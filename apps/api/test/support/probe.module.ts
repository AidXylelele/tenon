import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Controller, Get, Module } from '@nestjs/common';
import { InvitationPolicy } from '../../src/application/policies/invitation.policy.js';
import { DomainError } from '../../src/domain/errors.js';

class UnmappedDomainError extends DomainError {
  constructor() {
    super('A rule without an HTTP mapping was broken');
  }
}

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

  @Get('unmapped-domain-error')
  @Public()
  unmappedDomainError() {
    throw new UnmappedDomainError();
  }
}

@Module({ controllers: [ProbeController] })
export class ProbeModule {}
