import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KINDS, type TaskKind } from '@/operations/workflow-document';
import { accentOf, tileOf } from './families';
import { TaskIcon } from './task-icon';

describe('the look of a kind of step', () => {
  it.each<[TaskKind, TaskKind]>([
    ['run-script', 'run-shell'],
    ['emit', 'listen'],
    ['switch', 'for'],
    ['fork', 'try'],
  ])('%s_and_%s_are_one_family_so_they_share_a_hue', (one, other) => {
    expect(tileOf(one)).toBe(tileOf(other));
    expect(accentOf(one)).toBe(accentOf(other));
  });

  it.each<[TaskKind, TaskKind]>([
    ['http', 'set'],
    ['wait', 'emit'],
    ['raise', 'run-workflow'],
  ])('%s_and_%s_are_told_apart_by_their_hue', (one, other) => {
    expect(tileOf(one)).not.toBe(tileOf(other));
    expect(accentOf(one)).not.toBe(accentOf(other));
  });

  it('every_kind_has_an_icon_that_assistive_technologies_skip', () => {
    const icons = KINDS.map((info) => {
      const { container } = render(
        <TaskIcon kind={info.kind} className="size-4" />,
      );
      return container.querySelector('svg');
    });

    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveClass('size-4');
    }
  });

  it('kinds_of_different_families_have_different_icons', () => {
    const { container: call } = render(<TaskIcon kind="http" />);
    const { container: data } = render(<TaskIcon kind="set" />);

    expect(call.innerHTML).not.toBe(data.innerHTML);
  });
});
