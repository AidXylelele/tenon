import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveRefresh } from './live-refresh';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('a live view', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes_the_route_on_its_interval_while_in_flight_and_says_how_fresh_it_is', () => {
    render(<LiveRefresh active renderedAt={Date.now()} intervalMs={1500} />);

    act(() => vi.advanceTimersByTime(3100));

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Live · updated \d+ s ago/)).toBeInTheDocument();
  });

  it('a_settled_view_neither_refreshes_nor_shows_itself', () => {
    const { container } = render(
      <LiveRefresh active={false} renderedAt={Date.now()} />,
    );

    act(() => vi.advanceTimersByTime(10_000));

    expect(refresh).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('pauses_while_the_page_is_hidden', () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    render(<LiveRefresh active renderedAt={Date.now()} intervalMs={1000} />);
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    act(() => vi.advanceTimersByTime(5000));

    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText('Live · paused while hidden')).toBeInTheDocument();
    visibility.mockRestore();
  });
});
