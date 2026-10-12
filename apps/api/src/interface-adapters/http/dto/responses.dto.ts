import { ApiProperty } from '@nestjs/swagger';
import { InvitationStatus, Role } from '../../../domain/enums.js';

export class UserResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Role })
  role!: Role;
}

export class SessionResponse {
  @ApiProperty({ type: UserResponse })
  user!: UserResponse;
}

export class InvitationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ enum: InvitationStatus })
  status!: InvitationStatus;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class VerifiedInvitationResponse {
  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

export class AcceptedInvitationResponse {
  @ApiProperty({ type: UserResponse })
  user!: UserResponse;
}
