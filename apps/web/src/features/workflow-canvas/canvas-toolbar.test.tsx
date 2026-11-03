import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasToolbar } from './canvas-toolbar';
import type { Direction } from './layout';

const onDirection = vi.fn<(direction: Direction) => void>();
const onCollapseAll = vi.fn<() => void>();
const onExpandAll = vi.fn<() => void>();

// The toolbar of a canvas running a direction, with groups or without.
function draw(direction: Direction, grouped: boolean) {
  return render(
    <CanvasToolbar
      direction={direction}
      onDirection={onDirection}
      onCollapseAll={onCollapseAll}
      onExpandAll={onExpandAll}
      grouped={grouped}
    />,
  );
}

describe('how the viewer arranges a canvas', () => {
  beforeEach(() => {
    onDirection.mockReset();
    onCollapseAll.mockReset();
    onExpandAll.mockReset();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it('shows_the_direction_it_runs', () => {
    draw('down', false);

    expect(screen.getByRole('radio', { name: 'Top to bottom' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Left to right' }),
    ).not.toBeChecked();
  });

  it('turns_it_the_other_way', () => {
    draw('down', false);

    fireEvent.click(screen.getByRole('radio', { name: 'Left to right' }));

    expect(onDirection).toHaveBeenCalledWith('right');
  });

  it('the_direction_it_already_runs_stays_chosen', () => {
    draw('right', false);

    fireEvent.click(screen.getByRole('radio', { name: 'Left to right' }));

    expect(onDirection).not.toHaveBeenCalled();
  });

  it('a_workflow_without_blocks_has_nothing_to_open_or_close', () => {
    draw('down', false);

    expect(
      screen.queryByRole('button', { name: 'Close every block' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open every block' }),
    ).not.toBeInTheDocument();
  });

  it('closes_and_opens_every_block_at_once', () => {
    draw('down', true);

    fireEvent.click(screen.getByRole('button', { name: 'Close every block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open every block' }));

    expect(onCollapseAll).toHaveBeenCalledTimes(1);
    expect(onExpandAll).toHaveBeenCalledTimes(1);
  });

  it('says_what_each_kind_of_connection_means', () => {
    draw('down', false);

    fireEvent.click(
      screen.getByRole('button', { name: 'What the connections mean' }),
    );
    const meanings = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(meanings).toEqual([
      'Goes on to the next step',
      'A path of a choice',
      'Goes to a named step',
      'Taken when a step fails',
      'Leaves its block or ends the run',
      'The way a run went',
    ]);
  });
});
