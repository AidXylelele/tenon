import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chooseDirection,
  setCollapsed,
  toggleCollapsed,
  useCollapsed,
  useDirection,
} from './view-preferences';

// What a canvas of a workflow reads of the viewer's arrangement.
function Probe({ scope }: { readonly scope: string }) {
  const direction = useDirection();
  const collapsed = useCollapsed(scope);
  const closed = [...collapsed].join(' ');
  return (
    <p>
      {direction}: {closed === '' ? 'all open' : closed}
    </p>
  );
}

// Another tab of the console changes the stored arrangement.
function storeElsewhere(key: string, value: string) {
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

describe('how the viewer arranges a canvas', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    act(() => chooseDirection('down'));
    window.localStorage.clear();
  });

  it('a_canvas_runs_top_to_bottom_with_every_block_open_until_arranged', () => {
    render(<Probe scope="sales/fresh" />);

    expect(screen.getByText('down: all open')).toBeInTheDocument();
  });

  it('the_server_draws_it_the_same_way', () => {
    const html = renderToString(<Probe scope="sales/fresh" />);

    expect(html).toContain('down<!-- -->: <!-- -->all open');
  });

  it('the_direction_chosen_holds_for_every_canvas_and_is_kept', () => {
    render(
      <>
        <Probe scope="sales/one" />
        <Probe scope="sales/two" />
      </>,
    );

    act(() => chooseDirection('right'));

    expect(screen.getAllByText('right: all open')).toHaveLength(2);
    expect(window.localStorage.getItem('canvas.direction')).toBe('right');
  });

  it('the_closed_blocks_are_kept_per_workflow_in_order_and_once', () => {
    render(
      <>
        <Probe scope="sales/closed" />
        <Probe scope="sales/other" />
      </>,
    );

    act(() => setCollapsed('sales/closed', ['/do/2/b', '/do/0/a', '/do/2/b']));

    expect(screen.getByText('down: /do/0/a /do/2/b')).toBeInTheDocument();
    expect(screen.getByText('down: all open')).toBeInTheDocument();
    expect(window.localStorage.getItem('canvas.collapsed:sales/closed')).toBe(
      '["/do/0/a","/do/2/b"]',
    );
  });

  it('a_block_toggled_closes_and_toggled_again_opens', () => {
    render(<Probe scope="sales/toggled" />);

    act(() => toggleCollapsed('sales/toggled', '/do/0/a'));
    const closed = screen.queryByText('down: /do/0/a') !== null;
    act(() => toggleCollapsed('sales/toggled', '/do/0/a'));

    expect(closed).toBe(true);
    expect(screen.getByText('down: all open')).toBeInTheDocument();
  });

  it('an_arrangement_made_in_another_tab_shows_here', () => {
    render(<Probe scope="sales/shared" />);

    act(() => {
      storeElsewhere('canvas.direction', 'right');
      storeElsewhere('canvas.collapsed:sales/shared', '["/do/1/b"]');
    });

    expect(screen.getByText('right: /do/1/b')).toBeInTheDocument();
  });

  it.each([
    ['text that is not JSON', '{closed'],
    ['JSON that is not a list', '{"a": 1}'],
  ])('a_stored_arrangement_of_%s_leaves_every_block_open', (_, stored) => {
    window.localStorage.setItem('canvas.collapsed:sales/broken', stored);

    render(<Probe scope="sales/broken" />);

    expect(screen.getByText('down: all open')).toBeInTheDocument();
  });

  it('a_stored_list_keeps_only_its_ids', () => {
    window.localStorage.setItem(
      'canvas.collapsed:sales/mixed',
      '["/do/0/a", 3, null]',
    );

    render(<Probe scope="sales/mixed" />);

    expect(screen.getByText('down: /do/0/a')).toBeInTheDocument();
  });

  it('with_storage_blocked_the_arrangement_lasts_while_the_page_stays', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    render(<Probe scope="sales/blocked" />);

    act(() => {
      chooseDirection('right');
      setCollapsed('sales/blocked', ['/do/0/a']);
    });

    expect(screen.getByText('right: /do/0/a')).toBeInTheDocument();
  });
});
