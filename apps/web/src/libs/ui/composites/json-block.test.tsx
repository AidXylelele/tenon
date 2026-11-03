import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonBlock } from './json-block';

describe('a json value on the page', () => {
  it('is_pretty_printed_and_copyable', () => {
    const { container } = render(<JsonBlock value={{ total: 42 }} />);

    expect(container.querySelector('pre')?.textContent).toBe(
      '{\n  "total": 42\n}',
    );
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it.each([[null], [undefined]])('%s_shows_the_empty_text', (value) => {
    render(<JsonBlock value={value} empty="No output" />);

    expect(screen.getByText('No output')).toBeInTheDocument();
  });

  it('zero_is_a_value_not_nothing', () => {
    const { container } = render(<JsonBlock value={0} />);

    expect(container.querySelector('pre')?.textContent).toBe('0');
  });
});
