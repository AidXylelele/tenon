import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Transactional } from '@nestjs-cls/transactional';
import { ActivateRelease } from '../../../application/use-cases/activate-release.js';
import { DeactivateWorkflow } from '../../../application/use-cases/deactivate-workflow.js';
import type { User } from '../../../domain/user.js';
import { ActivateReleaseDto } from '../dto/activate-release.dto.js';
import { ActivationResponse } from '../dto/automation-responses.dto.js';

@ApiTags('workflows')
@ApiCookieAuth('sessionCookie')
@Controller('workflows/:id/activation')
export class ActivationController {
  constructor(
    private readonly activateRelease: ActivateRelease,
    private readonly deactivateWorkflow: DeactivateWorkflow,
  ) {}

  @Put()
  @Can.Anyone()
  @Transactional()
  @ApiOkResponse({ type: ActivationResponse })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'The workflow is archived' })
  @ApiUnprocessableEntityResponse({
    description:
      'The release has no trigger, or its nodes have configuration problems now',
  })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivateReleaseDto,
    @CurrentUser() user: User,
  ): Promise<ActivationResponse> {
    const workflow = await this.activateRelease.execute({
      actor: user,
      workflowId: id,
      releaseNumber: dto.release,
    });
    return { release: workflow.activeRelease ?? dto.release };
  }

  @Delete()
  @Can.Anyone()
  @Transactional()
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.deactivateWorkflow.execute({ actor: user, workflowId: id });
  }
}
