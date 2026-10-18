import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ActivateReleaseDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  release!: number;
}
