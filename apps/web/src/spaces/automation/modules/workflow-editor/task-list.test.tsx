import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JsonObject } from '@/libs/data-access/types';
import { TaskList } from './task-list';

const draft: JsonObject = {
  do: [
    {
      fetch: {
        call: 'http',
        with: { method: 'post', endpoint: 'https://crm.example.com/leads' },
      },
    },
    {
      each: {
        for: { each: 'lead', in: '${ .leads }' },
        do: [{ notify: { wait: { seconds: 5 } } }],
      },
    },
  ],
};

describe('the steps of the builder', () => {
  it('shows_each_step_with_what_it_does_nested_ones_inside_their_parent', () => {
    render(
      <TaskList
        draft={draft}
        listPointer="/do"
        selected={null}
        flagged={null}
        onSelect={vi.fn()}
        onInsert={vi.fn()}
      />,
    );

    expect(
      screen.getByText('POST https://crm.example.com/leads'),
    ).toBeInTheDocument();
    expect(screen.getByText('For each item')).toBeInTheDocument();
    expect(screen.getByText('Wait 5 seconds')).toBeInTheDocument();
  });

  it('picking_a_step_selects_it_by_its_pointer', () => {
    const onSelect = vi.fn();
    render(
      <TaskList
        draft={draft}
        listPointer="/do"
        selected={null}
        flagged={null}
        onSelect={onSelect}
        onInsert={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^notify/ }));

    expect(onSelect).toHaveBeenCalledWith('/do/1/each/do/0/notify');
  });

  it('a_step_from_the_palette_is_added_at_the_end_of_its_list', () => {
    const onInsert = vi.fn();
    render(
      <TaskList
        draft={draft}
        listPointer="/do"
        selected={null}
        flagged={null}
        onSelect={vi.fn()}
        onInsert={onInsert}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
    fireEvent.click(screen.getByRole('button', { name: /^Send an event/ }));

    expect(onInsert).toHaveBeenCalledWith('/do', 2, 'emit');
  });

  it('the_step_with_the_problem_is_marked', () => {
    render(
      <TaskList
        draft={draft}
        listPointer="/do"
        selected={null}
        flagged="/do/0/fetch"
        onSelect={vi.fn()}
        onInsert={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Has a problem')).toBeInTheDocument();
  });
});
