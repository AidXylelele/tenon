import { EventOriginKind } from '../../../../../src/domain/automation/events/enums.js';
import { Event } from '../../../../../src/domain/automation/events/event.js';
import { CloudEvent } from '../../../../../src/domain/automation/language/cloud-event.js';
import { now } from '../../../../support/progress.js';

const later = new Date(now.getTime() + 1_000);

describe('Event', () => {
  const origin = {
    kind: EventOriginKind.Emit,
    workflowId: 'workflow-1',
    instanceId: 'instance-1',
  };

  it('an_emitted_event_keeps_its_context_attributes_and_its_extensions_apart', () => {
    const cloudEvent = CloudEvent.of({
      specversion: '1.0',
      id: 'order-1',
      source: 'https://orders.example',
      type: 'order.placed',
      time: '2026-11-01T09:00:00.000Z',
      subject: 'orders/1',
      data: { id: 1 },
      traceid: 'abc',
    });

    if (cloudEvent === null) throw new Error('cloud event');

    const event = Event.emitted({
      cloudEvent,
      origin,
      sequence: 3,
      now,
    });

    expect(event.eventId).toBe('order-1');
    expect(event.time).toEqual(new Date('2026-11-01T09:00:00.000Z'));
    expect(event.subject).toBe('orders/1');
    expect(event.dataContentType).toBeNull();
    expect(event.extensions).toEqual({ traceid: 'abc' });
    expect(event.acceptedAt).toBe(now);
    expect(event.sequence).toBe(3);
  });

  it('a_lifecycle_event_takes_its_sequence_as_its_id_and_its_data_as_given', () => {
    const lifecycle = {
      kind: EventOriginKind.Lifecycle,
      workflowId: 'workflow-1',
      instanceId: 'instance-1',
    };

    const event = Event.lifecycle({
      source: '/workflows/default/orders/instances/instance-1',
      type: 'io.serverlessworkflow.workflow.started.v1',
      time: now,
      data: { name: 'orders-instance-1.default' },
      origin: lifecycle,
      sequence: 1,
      acceptedAt: later,
    });

    expect(event.eventId).toBe('1');
    expect(event.time).toBe(now);
    expect(event.dataContentType).toBe('application/json');
    expect(event.data).toEqual({ name: 'orders-instance-1.default' });
    expect(event.extensions).toEqual({});
    expect(event.acceptedAt).toBe(later);
  });
});
