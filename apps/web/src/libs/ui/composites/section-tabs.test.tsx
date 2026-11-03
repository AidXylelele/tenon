import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionTabs } from './section-tabs';

const pathname = vi.fn(() => '/connections/notifications/42');

vi.mock('next/navigation', () => ({ usePathname: () => pathname() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const TABS = [
  { href: '/connections/webhooks', label: 'Webhooks' },
  { href: '/connections/notifications', label: 'Notifications' },
];

describe('the tabs of a page made of several', () => {
  it('marks_the_tab_whose_address_holds_the_page', () => {
    render(<SectionTabs tabs={TABS} label="Connections" />);

    expect(screen.getByRole('navigation', { name: 'Connections' })).toBe(
      screen.getByRole('link', { name: 'Webhooks' }).closest('nav'),
    );
    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Webhooks' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('a_tab_whose_address_only_starts_the_same_is_not_current', () => {
    pathname.mockReturnValueOnce('/connections/webhooks-old');
    render(<SectionTabs tabs={TABS} label="Connections" />);

    expect(screen.getByRole('link', { name: 'Webhooks' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
