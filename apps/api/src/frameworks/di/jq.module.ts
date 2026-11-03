import { Module } from '@nestjs/common';
import { JqClient } from '../runtime/interfaces.js';
import { PiscinaJqClient } from '../jq/piscina-jq.client.js';

@Module({
  providers: [
    PiscinaJqClient,
    { provide: JqClient, useExisting: PiscinaJqClient },
  ],
  exports: [JqClient],
})
export class JqModule {}
