import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { intervalOf, RefreshControl } from './refresh-control';
import { chooseRefresh } from './refresh-preference';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('the refresh control', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    act(() => chooseRefresh('auto'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes_every_five_seconds_while_something_is_in_flight', () => {
    render(<RefreshControl activity="in-flight" renderedAt={Date.now()} />);

    act(() => vi.advanceTimersByTime(5100));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Updated \d+ s ago/)).toBeInTheDocument();
  });

  it('refreshes_a_list_every_minute_when_nothing_is_in_flight', () => {
    render(<RefreshControl activity="open" renderedAt={Date.now()} />);

    act(() => vi.advanceTimersByTime(59_000));
    const early = refresh.mock.calls.length;
    act(() => vi.advanceTimersByTime(2000));

    expect(early).toBe(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('an_ended_page_refreshes_only_when_asked', () => {
    render(<RefreshControl activity="ended" renderedAt={Date.now()} />);

    act(() => vi.advanceTimersByTime(600_000));
    const automatic = refresh.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));

    expect(automatic).toBe(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('follows_the_interval_the_viewer_chose_and_off_stops_it', () => {
    act(() => chooseRefresh('30000'));
    const { rerender } = render(
      <RefreshControl activity="in-flight" renderedAt={Date.now()} />,
    );

    act(() => vi.advanceTimersByTime(29_000));
    const before = refresh.mock.calls.length;
    act(() => vi.advanceTimersByTime(2000));
    const after = refresh.mock.calls.length;
    act(() => chooseRefresh('off'));
    rerender(<RefreshControl activity="in-flight" renderedAt={Date.now()} />);
    act(() => vi.advanceTimersByTime(600_000));

    expect(before).toBe(0);
    expect(after).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('waits_while_the_page_is_hidden_and_refreshes_on_return_when_due', () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    render(<RefreshControl activity="in-flight" renderedAt={Date.now()} />);
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    act(() => vi.advanceTimersByTime(20_000));
    const hidden = refresh.mock.calls.length;
    const paused = screen.getByText('Paused while hidden');
    visibility.mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(10));

    expect(hidden).toBe(0);
    expect(paused).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });
});

describe('the interval in force', () => {
  it.each([
    ['auto', 'in-flight', 5_000],
    ['auto', 'open', 60_000],
    ['auto', 'ended', null],
    ['10000', 'ended', 10_000],
    ['off', 'in-flight', null],
  ] as const)('%s_on_a_page_%s_is_%s', (choice, activity, interval) => {
    expect(intervalOf(choice, activity)).toBe(interval);
  });
});
