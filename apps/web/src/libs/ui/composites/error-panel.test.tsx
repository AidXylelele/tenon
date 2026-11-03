import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorPanel } from './error-panel';

describe('a page that could not be shown', () => {
  it('says_so_and_tries_again_when_asked', () => {
    const retry = vi.fn();
    render(<ErrorPanel retry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      screen.getByText('This page could not be loaded'),
    ).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('gives_the_reference_of_the_failure_when_there_is_one', () => {
    render(<ErrorPanel retry={vi.fn()} digest="1234567" />);

    expect(screen.getByText('Reference 1234567')).toBeInTheDocument();
  });
});
