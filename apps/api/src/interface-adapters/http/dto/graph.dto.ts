import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OnError } from '../../../domain/enums.js';
import {
  JsonLimits,
  MaxJsonBytes,
  MaxJsonDepth,
} from '../validators/json-limits.js';

export class RetryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  attempts?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 300_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300_000)
  waitMs?: number;
}

export class NodeSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alwaysOutputData?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  executeOnce?: boolean;

  @ApiPropertyOptional({ type: RetryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RetryDto)
  retry?: RetryDto;

  @ApiPropertyOptional({ enum: OnError })
  @IsOptional()
  @IsEnum(OnError)
  onError?: OnError;
}

export class NodeDto {
  static readonly MAX_PARAMETER_BYTES = 256 * 1024;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ example: 'editFields' })
  @IsString()
  @Length(1, 120)
  type!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  typeVersion!: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Bindings: { fixed }, { ref: { node, path } } or { formula }',
  })
  @IsOptional()
  @IsObject()
  @MaxJsonDepth(JsonLimits.DEPTH)
  @MaxJsonBytes(NodeDto.MAX_PARAMETER_BYTES)
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'string', format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  credentialId?: string | null;

  @ApiPropertyOptional({ type: NodeSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NodeSettingsDto)
  settings?: NodeSettingsDto;

  @ApiProperty({ type: [Number], minItems: 2, maxItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  position!: [number, number];

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;
}

export class ConnectionOutputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  node!: string;

  @ApiProperty({ example: 'main' })
  @IsString()
  @Length(1, 120)
  output!: string;
}

export class ConnectionInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  node!: string;

  @ApiProperty({ example: 'main' })
  @IsString()
  @Length(1, 120)
  input!: string;
}

export class ConnectionDto {
  @ApiProperty({ type: ConnectionOutputDto })
  @ValidateNested()
  @Type(() => ConnectionOutputDto)
  from!: ConnectionOutputDto;

  @ApiProperty({ type: ConnectionInputDto })
  @ValidateNested()
  @Type(() => ConnectionInputDto)
  to!: ConnectionInputDto;
}

export class GraphDto {
  @ApiProperty({ type: [NodeDto], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes!: NodeDto[];

  @ApiProperty({ type: [ConnectionDto], maxItems: 1000 })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ConnectionDto)
  connections!: ConnectionDto[];
}

export class WorkflowSettingsDto {
  @ApiPropertyOptional({ example: 'Europe/Kyiv', default: 'UTC' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({
    minimum: 1_000,
    maximum: 2_592_000_000,
    default: 3_600_000,
  })
  @IsOptional()
  @IsInt()
  @Min(1_000)
  @Max(2_592_000_000)
  runTimeoutMs?: number;

  @ApiPropertyOptional({ type: 'string', format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  errorWorkflowId?: string | null;
}

export class SaveDraftDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({ type: GraphDto })
  @ValidateNested()
  @Type(() => GraphDto)
  graph!: GraphDto;

  @ApiProperty({ type: WorkflowSettingsDto })
  @ValidateNested()
  @Type(() => WorkflowSettingsDto)
  settings!: WorkflowSettingsDto;
}
