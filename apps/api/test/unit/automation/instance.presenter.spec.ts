import type { EventView } from '../../../src/application/automation/instances/queries.js';
import { InstancePresenter } from '../../../src/interface-adapters/api/presenters/instance.presenter.js';

function completed(output: string): EventView {
  return {
    id: '7',
    source: '/workflows/default/orders/instances/instance-1',
    type: 'io.serverlessworkflow.task.completed.v1',
    time: new Date('2026-11-01T10:00:00.000Z'),
    subject: null,
    dataContentType: 'application/json',
    dataSchema: null,
    data: {
      workflow: 'orders-instance-1.default',
      task: '/do/0/fetch',
      completedAt: '2026-11-01T10:00:00.000Z',
      output,
    },
    extensions: {},
  };
}

describe('InstancePresenter', () => {
  it('a_lifecycle_event_within_64_kib_is_written_whole_as_a_cloud_event', () => {
    const event = InstancePresenter.event(completed('small'));

    expect(event).toMatchObject({
      specversion: '1.0',
      id: '7',
      datacontenttype: 'application/json',
      data: { output: 'small', task: '/do/0/fetch' },
    });
  });

  it('a_lifecycle_event_that_would_outgrow_64_kib_leaves_its_output_out', () => {
    const large = 'x'.repeat(64 * 1024);

    const event = InstancePresenter.event(completed(large));

    expect(event.data).toEqual({
      workflow: 'orders-instance-1.default',
      task: '/do/0/fetch',
      completedAt: '2026-11-01T10:00:00.000Z',
    });
  });
});
