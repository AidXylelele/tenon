import { LifecycleEvent } from '../../../../../src/domain/automation/instances/lifecycle-event.js';
import { LifecycleEventType } from '../../../../../src/domain/automation/instances/lifecycle-event-type.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { WorkflowName } from '../../../../../src/domain/automation/language/workflow-name.js';
import { now } from '../../../../support/progress.js';

describe('LifecycleEvent', () => {
  const subject = {
    instanceId: 'instance-1',
    workflowId: 'workflow-1',
    workflow: new WorkflowName('sales', 'leads'),
    semver: '1.0.0',
  };
  const task = JsonPointer.root().at('do').at(0).at('enrich');

  const completed = (value: string): LifecycleEvent =>
    new LifecycleEvent({
      type: LifecycleEventType.TaskCompleted,
      subject,
      task,
      sequence: 7,
      time: now,
      error: null,
      output: { value },
    });

  it('a_task_completed_event_carries_its_output_within_64_kib', () => {
    const event = completed('small').toEvent();

    expect(event.type).toBe('io.serverlessworkflow.task.completed.v1');
    expect(event.source).toBe('/workflows/sales/leads/instances/instance-1');
    expect(event.eventId).toBe('7');
    expect(event.data).toEqual({
      workflow: 'leads-instance-1.sales',
      task: '/do/0/enrich',
      completedAt: now.toISOString(),
      output: 'small',
    });
  });

  it('an_output_that_would_pass_64_kib_is_left_out_of_the_event', () => {
    const large = 'x'.repeat(64 * 1024);

    const event = completed(large).toEvent();

    expect(event.data).toEqual({
      workflow: 'leads-instance-1.sales',
      task: '/do/0/enrich',
      completedAt: now.toISOString(),
    });
  });
});
