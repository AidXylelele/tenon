import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsObject } from 'class-validator';
import {
  JsonLimits,
  MaxJsonBytes,
  MaxJsonDepth,
} from '../validators/json-limits.js';

export class PinnedItemsDto {
  static readonly MAX_ITEMS = 100;
  static readonly MAX_BYTES = 1024 * 1024;

  @ApiProperty({ type: 'array', items: { type: 'object' }, maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(PinnedItemsDto.MAX_ITEMS)
  @IsObject({ each: true })
  @MaxJsonDepth(JsonLimits.DEPTH, { each: true })
  @MaxJsonBytes(PinnedItemsDto.MAX_BYTES)
  items!: Record<string, unknown>[];
}
