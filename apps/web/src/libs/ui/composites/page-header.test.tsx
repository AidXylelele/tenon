import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageHeader } from './page-header';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('the heading of a page', () => {
  it('says_where_the_page_sits_with_its_parents_as_links', () => {
    render(
      <PageHeader
        title="route-lead"
        crumbs={[
          { label: 'Workflows', href: '/workflows' },
          { label: 'route-lead' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Workflows' })).toHaveAttribute(
      'href',
      '/workflows',
    );
    expect(screen.getByRole('link', { name: 'route-lead' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'route-lead' }),
    ).not.toHaveAttribute('href');
    expect(
      screen.getByRole('heading', { level: 1, name: 'route-lead' }),
    ).toBeInTheDocument();
  });

  it('shows_its_description_and_actions', () => {
    render(
      <PageHeader
        title="Webhooks"
        description="Other applications send events in."
        actions={<button type="button">New webhook</button>}
      />,
    );

    expect(
      screen.getByText('Other applications send events in.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New webhook' }),
    ).toBeInTheDocument();
  });

  it('a_tab_of_a_larger_page_names_itself_for_assistive_technologies_only', () => {
    render(<PageHeader title="Webhooks" level={2} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('sr-only');
  });
});
