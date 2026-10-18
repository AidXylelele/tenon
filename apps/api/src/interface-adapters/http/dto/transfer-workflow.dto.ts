import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferWorkflowDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerId!: string;
}
