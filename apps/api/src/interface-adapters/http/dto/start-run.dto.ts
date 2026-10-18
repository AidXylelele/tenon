import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  JsonLimits,
  MaxJsonBytes,
  MaxJsonDepth,
} from '../validators/json-limits.js';
import { OneOf } from '../validators/one-of.js';
import { RevisionDto } from './revision.dto.js';

export class RunTargetDto {
  @ApiPropertyOptional({ type: RevisionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RevisionDto)
  draft?: RevisionDto;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  release?: number;
}

export class StartRunDto {
  static readonly MAX_ITEMS = 1000;
  static readonly MAX_BYTES = 1024 * 1024;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  workflowId!: string;

  @ApiProperty({
    type: RunTargetDto,
    description: 'Exactly one of draft or release',
  })
  @ValidateNested()
  @Type(() => RunTargetDto)
  @OneOf(['draft', 'release'])
  target!: RunTargetDto;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  triggerNodeId!: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    maxItems: 1000,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(StartRunDto.MAX_ITEMS)
  @IsObject({ each: true })
  @MaxJsonDepth(JsonLimits.DEPTH, { each: true })
  @MaxJsonBytes(StartRunDto.MAX_BYTES)
  items?: Record<string, unknown>[];
}
