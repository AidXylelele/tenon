import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  conformance,
  instances,
  publishEvent,
  startInstance,
  subscription,
  turnWorkflow,
  versionDocument,
  workflow,
  workflows,
} from './automation';

const read = vi.fn();
const command = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('./http', () => ({
  read: (...args: unknown[]) => read(...args),
  command: (...args: unknown[]) => command(...args),
}));

const NOW = Date.parse('2026-11-03T12:00:00Z');

describe('the automation routes', () => {
  beforeEach(() => {
    read.mockReset();
    command.mockReset();
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists_instances_by_the_filter_the_api_offers_stamped_with_when_they_arrived', async () => {
    read.mockResolvedValue({ items: [], next: 'c2' });

    const page = await instances({
      phase: 'faulted',
      startedFrom: '2026-11-02T12:00:00Z',
      limit: 200,
    });

    expect(read).toHaveBeenCalledWith('/instances', {
      query: {
        phase: 'faulted',
        startedFrom: '2026-11-02T12:00:00Z',
        limit: 200,
      },
    });
    expect(page).toEqual({ items: [], next: 'c2', readAt: NOW });
  });

  it('no_instances_is_an_empty_page', async () => {
    read.mockResolvedValue(null);

    const page = await instances({});

    expect(page).toEqual({ items: [], next: null, readAt: NOW });
  });

  it('lists_workflows_by_status_fifty_at_a_time', async () => {
    read.mockResolvedValue(null);

    const page = await workflows('archived', 'c1');

    expect(read).toHaveBeenCalledWith('/workflows', {
      query: { status: 'archived', cursor: 'c1', limit: 50 },
    });
    expect(page).toEqual({ items: [], next: null });
  });

  it('a_workflow_address_escapes_its_namespace_and_name', async () => {
    read.mockResolvedValue(null);

    await workflow('sales team', 'route/lead');

    expect(read).toHaveBeenCalledWith('/workflows/sales%20team/route%2Flead');
  });

  it('a_published_document_is_read_once_and_kept', async () => {
    read.mockResolvedValue({});

    await versionDocument('sales', 'route-lead', '1.0.0');

    expect(read).toHaveBeenCalledWith(
      '/workflows/sales/route-lead/versions/1.0.0',
      { immutable: true },
    );
  });

  it('a_start_carries_its_idempotency_key', async () => {
    command.mockResolvedValue({ ok: true, value: { id: 'run-1' } });

    await startInstance('sales', 'route-lead', 'latest', { a: 1 }, 'key-1');

    expect(command).toHaveBeenCalledWith(
      '/workflows/sales/route-lead/instances',
      {
        method: 'POST',
        json: { version: 'latest', input: { a: 1 } },
        headers: { 'idempotency-key': 'key-1' },
      },
    );
  });

  it.each([
    [true, '/workflows/sales/route-lead/turn-on'],
    [false, '/workflows/sales/route-lead/turn-off'],
  ])('turning_%s_posts_to_%s', async (on, path) => {
    command.mockResolvedValue({ ok: true, value: undefined });

    await turnWorkflow('sales', 'route-lead', on);

    expect(command).toHaveBeenCalledWith(path, { method: 'POST' });
  });

  it('an_event_is_sent_as_a_structured_cloudevent', async () => {
    command.mockResolvedValue({ ok: true, value: undefined });
    const event = {
      specversion: '1.0',
      id: 'e-1',
      source: '/shop',
      type: 'com.example.order.paid',
    };

    await publishEvent(event);

    expect(command).toHaveBeenCalledWith('/events', {
      method: 'POST',
      text: JSON.stringify(event),
      contentType: 'application/cloudevents+json',
    });
  });

  it('a_subscription_is_stamped_and_a_missing_one_is_null', async () => {
    read.mockResolvedValueOnce({ id: 's-1' }).mockResolvedValueOnce(null);

    const found = await subscription('s-1');
    const missing = await subscription('s-2');

    expect(found).toEqual({ id: 's-1', readAt: NOW });
    expect(missing).toBeNull();
  });

  it('a_platform_that_states_no_conformance_fails', async () => {
    read.mockResolvedValue(null);

    const reading = conformance();

    await expect(reading).rejects.toThrow('The API states no conformance');
  });
});
