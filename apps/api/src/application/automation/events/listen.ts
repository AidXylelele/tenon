import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Clock } from '../ports.js';
import { ListenerStore } from './ports.js';

export interface ListenCommand {
  readonly instanceId: string;
  readonly key: string;
  readonly types: string[] | null;
}

// A `listen` task began: events accepted from now on reach it (US7: earlier ones do not).
@Injectable()
export class Listen {
  constructor(
    private readonly listeners: ListenerStore,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: ListenCommand): Promise<void> {
    const now = this.clock.now();
    await this.listeners.add(
      command.instanceId,
      command.key,
      command.types,
      now,
    );
  }
}
