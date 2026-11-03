import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useHydrated } from './use-hydrated';

function Probe() {
  const hydrated = useHydrated();
  return <span>{hydrated ? 'browser' : 'server'}</span>;
}

describe('whether the page runs in the browser', () => {
  it('is_false_on_the_server', () => {
    const html = renderToString(<Probe />);

    expect(html).toContain('server');
  });

  it('is_true_once_the_browser_renders', () => {
    render(<Probe />);

    expect(screen.getByText('browser')).toBeInTheDocument();
  });
});
