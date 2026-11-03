import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartDialog } from './start-dialog';

const push = vi.fn();
const startAction = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./actions', () => ({
  startAction: (...args: unknown[]) => startAction(...args),
}));

const unreachable = {
  ok: false,
  problem: {
    type: 'about:blank',
    title: 'The platform is not answering',
    status: 503,
    detail: 'timeout',
    errors: [],
  },
};

describe('starting a run', () => {
  beforeEach(() => {
    push.mockClear();
    startAction.mockReset();
  });

  function openWith(json: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.change(screen.getByLabelText('Input'), {
      target: { value: json },
    });
  }

  it('a_retried_start_carries_the_same_key_and_a_changed_one_a_new_key', async () => {
    startAction.mockResolvedValue(unreachable);
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        versions={['1.0.0']}
        fields={null}
      />,
    );
    openWith('{"email": "ada@example.com"}');

    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    await screen.findByText('The platform is not answering');
    fireEvent.click(await screen.findByRole('button', { name: 'Start run' }));
    await waitFor(() => expect(startAction).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Input'), {
      target: { value: '{"email": "bob@example.com"}' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Start run' }));
    await waitFor(() => expect(startAction).toHaveBeenCalledTimes(3));

    const keys = startAction.mock.calls.map((call) => call[4]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('a_started_run_opens_its_page', async () => {
    startAction.mockResolvedValue({ ok: true, value: { id: 'run-1' } });
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        versions={[]}
        fields={null}
      />,
    );
    openWith('{}');

    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/instances/run-1'));
    expect(startAction).toHaveBeenCalledWith(
      'sales',
      'route-lead',
      'latest',
      {},
      expect.any(String),
    );
  });

  it('an_input_that_is_not_json_is_refused_before_anything_is_sent', () => {
    render(
      <StartDialog
        namespace="sales"
        name="route-lead"
        versions={[]}
        fields={null}
      />,
    );
    openWith('{ not json');

    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));

    expect(startAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Input')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
