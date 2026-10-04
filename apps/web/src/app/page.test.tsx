import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home page', () => {
  it('renders the platform heading', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Workflow Platform' }),
    ).toBeInTheDocument();
  });
});
