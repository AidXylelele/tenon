import { CloudEvent } from '../../../../../src/domain/automation/language/cloud-event.js';

describe('CloudEvent', () => {
  const event = {
    id: 'order-1',
    source: 'https://orders.example',
    type: 'order.placed',
  };

  it('a_well_formed_event_keeps_its_attributes_and_extensions', () => {
    const cloudEvent = CloudEvent.of({
      ...event,
      time: '2026-11-01T09:00:00Z',
      dataschema: 'https://schemas.example/order.json',
      traceid: 'abc',
      sampled: true,
      depth: 3,
    });

    expect(cloudEvent?.extensions).toEqual({
      traceid: 'abc',
      sampled: true,
      depth: 3,
    });
  });

  it.each([
    ['an empty id', { id: '' }],
    ['an empty type', { type: '' }],
    ['an empty subject', { subject: '' }],
    ['another spec version', { specversion: '0.3' }],
    ['a time that is not RFC 3339', { time: 'March 7, 2024' }],
    ['a source that is not a URI reference', { source: 'not a uri ref' }],
    ['a relative data schema', { dataschema: 'order.json' }],
    ['an object extension', { ext: { a: 1 } }],
    ['a fractional extension', { ext: 1.5 }],
    ['an upper-case attribute name', { TraceId: 'abc' }],
  ])('an_event_with_%s_is_not_a_cloud_event', (_, overrides) => {
    const cloudEvent = CloudEvent.of({ ...event, ...overrides });

    expect(cloudEvent).toBeNull();
  });
});
