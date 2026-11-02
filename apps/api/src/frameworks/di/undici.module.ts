import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EndpointClient } from '../../interface-adapters/workflows/services/interfaces.js';
import {
  createEndpointDispatcher,
  EndpointDispatcher,
} from '../undici/endpoint-dispatcher.js';
import { UndiciEndpointClient } from '../undici/undici-endpoint.client.js';
import type { Env } from './config.module.js';

@Module({
  providers: [
    {
      provide: EndpointDispatcher,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createEndpointDispatcher(
          config.get('OUTBOUND_ALLOW_LIST', { infer: true }),
        ),
    },
    UndiciEndpointClient,
    { provide: EndpointClient, useExisting: UndiciEndpointClient },
  ],
  exports: [EndpointClient],
})
export class UndiciModule implements OnApplicationShutdown {
  constructor(private readonly dispatcher: EndpointDispatcher) {}

  onApplicationShutdown(): Promise<void> {
    return this.dispatcher.close();
  }
}
