import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ListenerStore } from './ports.js';

export interface ListenCommand {
  readonly instanceId: string;
  readonly key: string;
  readonly types: string[] | null;
}

// A `listen` task began: events accepted from now on reach it (US7: earlier ones do not).
@Injectable()
export class Listen {
  constructor(private readonly listeners: ListenerStore) {}

  @Transactional()
  async execute(command: ListenCommand): Promise<void> {
    await this.listeners.add(command.instanceId, command.key, command.types);
  }
}
