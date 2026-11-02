import { Module } from '@nestjs/common';
import { JqClient } from '../../interface-adapters/workflows/expressions/interfaces.js';
import { PiscinaJqClient } from '../jq/piscina-jq.client.js';

@Module({
  providers: [
    PiscinaJqClient,
    { provide: JqClient, useExisting: PiscinaJqClient },
  ],
  exports: [JqClient],
})
export class JqModule {}
