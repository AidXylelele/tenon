import { Module } from '@nestjs/common';
import { OpenWorkflowClient } from '../../interface-adapters/workflows/definitions/interfaces.js';
import { SdkOpenWorkflowClient } from '../openworkflowspec/sdk-open-workflow.client.js';

@Module({
  providers: [
    SdkOpenWorkflowClient,
    { provide: OpenWorkflowClient, useExisting: SdkOpenWorkflowClient },
  ],
  exports: [OpenWorkflowClient],
})
export class OpenWorkflowSpecModule {}
