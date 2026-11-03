import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from './use-mobile';

const listeners = new Set<() => void>();
let width = 1280;

function Probe() {
  const mobile = useIsMobile();
  return <span>{mobile ? 'phone' : 'wide'}</span>;
}

// The viewport takes a width, and the media query reports the change.
function resizeTo(pixels: number) {
  width = pixels;
  listeners.forEach((listener) => listener());
}

describe('whether the viewport is a phone', () => {
  beforeEach(() => {
    width = 1280;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        const limit = Number(/max-width: (\d+)px/.exec(query)?.[1]);
        return width <= limit;
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

  it('is_wide_on_the_server', () => {
    const html = renderToString(<Probe />);

    expect(html).toContain('wide');
  });

  it('narrower_than_the_sidebar_breakpoint_is_a_phone', () => {
    render(<Probe />);
    const first = screen.getByText(/phone|wide/).textContent;

    act(() => resizeTo(767));
    const narrow = screen.getByText(/phone|wide/).textContent;
    act(() => resizeTo(768));

    expect(first).toBe('wide');
    expect(narrow).toBe('phone');
    expect(screen.getByText('wide')).toBeInTheDocument();
  });
});
