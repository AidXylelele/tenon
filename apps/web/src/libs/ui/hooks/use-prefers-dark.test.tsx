import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrefersDark } from './use-prefers-dark';

const listeners = new Set<() => void>();
let dark = false;

function Probe() {
  const prefersDark = usePrefersDark();
  return <span>{prefersDark ? 'dark' : 'light'}</span>;
}

// The system's colour scheme changes, as the media query reports it.
function switchTo(scheme: 'dark' | 'light') {
  dark = scheme === 'dark';
  listeners.forEach((listener) => listener());
}

describe('the system colour scheme', () => {
  beforeEach(() => {
    dark = false;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === '(prefers-color-scheme: dark)' && dark;
      },
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is_light_on_the_server', () => {
    const html = renderToString(<Probe />);

    expect(html).toContain('light');
  });

  it('follows_the_system_as_it_changes', () => {
    render(<Probe />);
    const first = screen.getByText(/dark|light/).textContent;

    act(() => switchTo('dark'));

    expect(first).toBe('light');
    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  it('stops_listening_once_nothing_shows_it', () => {
    const { unmount } = render(<Probe />);
    const listening = listeners.size;

    unmount();

    expect(listening).toBe(1);
    expect(listeners.size).toBe(0);
  });
});
