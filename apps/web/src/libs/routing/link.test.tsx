import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Link } from './link';

// Next's link, reduced to what this one decides: whether it prefetches.
vi.mock('next/link', () => ({
  default: ({
    prefetch,
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { readonly prefetch: boolean | null }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

describe('a link', () => {
  it('loads_its_page_ahead_only_once_the_person_shows_intent', () => {
    render(<Link href="/workflows">Workflows</Link>);
    const link = screen.getByRole('link', { name: 'Workflows' });
    const before = link.dataset.prefetch;

    fireEvent.mouseEnter(link);

    expect(before).toBe('false');
    expect(link.dataset.prefetch).toBe('null');
  });

  it.each([
    ['focus', fireEvent.focus],
    ['touch', fireEvent.touchStart],
  ])('a_%s_shows_intent_too', (_, show) => {
    render(<Link href="/workflows">Workflows</Link>);
    const link = screen.getByRole('link', { name: 'Workflows' });

    show(link);

    expect(link.dataset.prefetch).toBe('null');
  });

  it('the_handlers_it_was_given_still_run', () => {
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    const onTouchStart = vi.fn();
    render(
      <Link
        href="/workflows"
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        onTouchStart={onTouchStart}
      >
        Workflows
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'Workflows' });

    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    fireEvent.touchStart(link);

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onTouchStart).toHaveBeenCalledTimes(1);
  });
});
