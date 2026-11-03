import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Status, type Tone, toneClasses } from './status';

describe('a state shown as a coloured dot and its word', () => {
  it.each<[Tone, string]>([
    ['busy', 'text-sky-700'],
    ['waiting', 'text-amber-700'],
    ['held', 'text-violet-700'],
    ['done', 'text-emerald-700'],
    ['failed', 'text-red-700'],
    ['ended', 'text-muted-foreground'],
    ['idle', 'text-muted-foreground'],
  ])('a_%s_state_reads_in_its_colour', (tone, colour) => {
    render(<Status tone={tone} label="State" />);

    expect(screen.getByText('State')).toHaveClass(colour);
  });

  it('the_dot_carries_the_tone_and_stays_hidden_from_assistive_technologies', () => {
    const { container } = render(<Status tone="failed" label="Faulted" />);
    const dot = container.querySelector(`.${toneClasses('failed').dot}`);

    expect(dot).not.toBeNull();
    expect(dot?.closest('[aria-hidden]')).not.toBeNull();
  });

  it('a_live_state_pulses_and_a_settled_one_does_not', () => {
    const { container, rerender } = render(
      <Status tone="busy" label="Running" live />,
    );
    const live = container.querySelectorAll('.animate-ping').length;

    rerender(<Status tone="busy" label="Running" />);

    expect(live).toBe(1);
    expect(container.querySelectorAll('.animate-ping')).toHaveLength(0);
  });

  it('every_tone_has_its_own_dot', () => {
    const tones: Tone[] = [
      'idle',
      'busy',
      'waiting',
      'held',
      'done',
      'failed',
      'ended',
    ];
    const dots = new Set(tones.map((tone) => toneClasses(tone).dot));

    expect(dots.size).toBe(tones.length);
  });
});
