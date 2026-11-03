import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeEditor } from './code-editor';

const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

// The CodeMirror surface, reduced to a text area with the same props.
vi.mock('next/dynamic', () => ({
  default: () =>
    function Surface({
      value,
      onChange,
      label,
    }: {
      readonly value: string;
      readonly onChange: (value: string) => void;
      readonly label: string;
    }) {
      return (
        <textarea
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    },
}));

describe('a code field', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('names_its_language_and_offers_format_only_where_a_formatter_runs', () => {
    const { rerender } = render(
      <CodeEditor value="" onChange={vi.fn()} language="json" label="Body" />,
    );
    const offeredForJson = screen.queryByRole('button', { name: 'Format' });
    const formatsJson = offeredForJson !== null;

    rerender(
      <CodeEditor value="" onChange={vi.fn()} language="python" label="Body" />,
    );

    expect(formatsJson).toBe(true);
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Format' })).toBeNull();
  });

  it('formats_the_code_into_the_field', async () => {
    const onChange = vi.fn();
    render(
      <CodeEditor
        value='{"a":1}'
        onChange={onChange}
        language="json"
        label="Body"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Format' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('{\n  "a": 1\n}'),
    );
  });

  it('code_that_cannot_be_formatted_is_kept_and_the_reason_said', async () => {
    const onChange = vi.fn();
    render(
      <CodeEditor
        value='{"a":'
        onChange={onChange}
        language="json"
        label="Body"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Format' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0]?.[0]).toBe(
      'The code could not be formatted',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an_empty_field_has_nothing_to_format', () => {
    render(
      <CodeEditor value="  " onChange={vi.fn()} language="json" label="Body" />,
    );

    expect(screen.getByRole('button', { name: 'Format' })).toBeDisabled();
  });

  it('opens_the_same_code_in_a_large_editor', () => {
    const onChange = vi.fn();
    render(
      <CodeEditor
        value="return 1;"
        onChange={onChange}
        language="javascript"
        label="Script"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Script in a large editor' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Script' });
    const large = within(dialog).getByRole('textbox', { name: 'Script' });
    expect(large).toHaveValue('return 1;');
    fireEvent.change(large, { target: { value: 'return 2;' } });

    expect(onChange).toHaveBeenCalledWith('return 2;');
  });
});
