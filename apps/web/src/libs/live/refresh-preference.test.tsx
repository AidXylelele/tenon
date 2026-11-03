import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseRefresh, useRefreshChoice } from './refresh-preference';

function Probe() {
  const choice = useRefreshChoice();
  return <span>{choice}</span>;
}

describe('the refresh interval the viewer chose', () => {
  beforeEach(() => {
    window.localStorage.clear();
    act(() => chooseRefresh('auto'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is_auto_on_the_server', () => {
    const html = renderToString(<Probe />);

    expect(html).toContain('auto');
  });

  it('is_kept_in_this_browser_and_shown_at_once', () => {
    render(<Probe />);

    act(() => chooseRefresh('30000'));

    expect(window.localStorage.getItem('console.refresh')).toBe('30000');
    expect(screen.getByText('30000')).toBeInTheDocument();
  });

  it('follows_a_choice_made_in_another_tab', () => {
    render(<Probe />);

    act(() => {
      window.localStorage.setItem('console.refresh', 'off');
      window.dispatchEvent(new Event('storage'));
    });

    expect(screen.getByText('off')).toBeInTheDocument();
  });

  it('a_stored_value_it_does_not_know_is_ignored', () => {
    window.localStorage.setItem('console.refresh', '1');
    render(<Probe />);

    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('with_storage_blocked_the_choice_lasts_while_the_page_stays', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    render(<Probe />);

    act(() => chooseRefresh('60000'));

    expect(screen.getByText('60000')).toBeInTheDocument();
  });
});
