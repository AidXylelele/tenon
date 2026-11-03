import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { ListenerStore } from './ports.js';

export interface UnlistenCommand {
  readonly instanceId: string;
  readonly key: string;
}

// A `listen` task ended: no more events reach it.
@Injectable()
export class Unlisten {
  constructor(private readonly listeners: ListenerStore) {}

  @Transactional()
  async execute(command: UnlistenCommand): Promise<void> {
    await this.listeners.remove(command.instanceId, command.key);
  }
}
