import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './copy-button';

const toastError = vi.fn();
const writeText = vi.fn();

vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

describe('a copy button', () => {
  beforeEach(() => {
    toastError.mockClear();
    writeText.mockReset();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('copies_the_value_and_says_so_for_a_moment', async () => {
    vi.useFakeTimers();
    writeText.mockResolvedValue(undefined);
    render(<CopyButton value="https://hooks.example.com/abc" size="sm" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    const said = screen.getByRole('button', { name: 'Copy' }).textContent;
    act(() => vi.advanceTimersByTime(1500));

    expect(writeText).toHaveBeenCalledWith('https://hooks.example.com/abc');
    expect(said).toBe('Copied');
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveTextContent(
      'Copy',
    );
  });

  it('a_refused_copy_says_to_select_the_text', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<CopyButton value="secret" label="Copy the URL" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the URL' }));
    });

    expect(toastError).toHaveBeenCalledWith(
      'The browser refused to copy; select the text instead.',
    );
  });

  it('an_icon_button_keeps_its_label_for_assistive_technologies', () => {
    render(<CopyButton value="x" label="Copy the token" />);

    expect(
      screen.getByRole('button', { name: 'Copy the token' }),
    ).toHaveTextContent('');
  });
});
