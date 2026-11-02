import { ProcessDetached } from '../../../domain/automation/instances/domain-events/process-detached.js';
import type { InstanceEvent } from '../../../domain/automation/instances/interfaces.js';
import { DomainEventTopic } from '../../enums.js';
import type { OutboxEntry } from '../interfaces.js';

export class DomainEventMapper {
  static toEntry(event: InstanceEvent): OutboxEntry {
    if (event instanceof ProcessDetached)
      return {
        topic: DomainEventTopic.ProcessDetached,
        key: event.taskInstanceId,
        payload: {
          instanceId: event.instanceId,
          taskInstanceId: event.taskInstanceId,
          run: {
            id: event.run.id,
            kind: event.run.kind,
            language: event.run.language,
            process: event.run.process,
          },
        },
      };

    const detached = event.detached;
    return {
      topic: DomainEventTopic.WorkflowDetached,
      key: event.subWorkflowId,
      payload: {
        instanceId: event.instanceId,
        taskInstanceId: event.taskInstanceId,
        subWorkflowId: event.subWorkflowId,
        detached: {
          namespace: detached.workflow.namespace,
          name: detached.workflow.name,
          versionId: detached.versionId,
          input: detached.input,
        },
      },
    };
  }
}
