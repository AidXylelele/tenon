import { Injectable } from '@nestjs/common';
import type { User } from '../../domain/identity/user.js';
import { UserRepository } from './ports.js';

@Injectable()
export class ResolveSessionUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User | null> {
    const user = await this.users.findById(userId);

    if (!user?.isActive) return null;

    return user;
  }
}
