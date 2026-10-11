import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../domain/user.js';

export class UserResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: User.ROLES })
  role!: string;
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

  @ApiProperty({ enum: User.ROLES })
  role!: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'revoked', 'expired'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}

export class VerifiedInvitationResponse {
  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: User.ROLES })
  role!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

export class AcceptedInvitationResponse {
  @ApiProperty({ type: UserResponse })
  user!: UserResponse;
}
