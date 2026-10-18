import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { RunStatus } from '../../../domain/enums.js';
import { PageQuery } from './page.query.js';

export class ListRunsQuery extends PageQuery {
  @ApiPropertyOptional({ enum: RunStatus })
  @IsOptional()
  @IsEnum(RunStatus)
  status?: RunStatus;
}
