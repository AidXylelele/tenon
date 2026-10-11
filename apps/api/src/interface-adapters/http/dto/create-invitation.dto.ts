import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';
import type { RoleName } from '../../../domain/interfaces.js';
import { User } from '../../../domain/user.js';

export class CreateInvitationDto {
  @ApiProperty({ format: 'email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: User.ROLES })
  @IsIn(User.ROLES)
  role!: RoleName;
}
