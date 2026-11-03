import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EndpointClient } from '../runtime/interfaces.js';
import {
  createEndpointDispatcher,
  EndpointDispatcher,
} from '../undici/endpoint-dispatcher.js';
import { DeliveryClient } from '../../interface-adapters/messaging/interfaces.js';
import { UndiciDeliveryClient } from '../undici/undici-delivery.client.js';
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
    UndiciDeliveryClient,
    { provide: DeliveryClient, useExisting: UndiciDeliveryClient },
  ],
  exports: [EndpointClient, DeliveryClient],
})
export class UndiciModule implements OnApplicationShutdown {
  constructor(private readonly dispatcher: EndpointDispatcher) {}

  onApplicationShutdown(): Promise<void> {
    return this.dispatcher.close();
  }
}
