import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ViewerNotice } from './viewer-notice';

describe('a page only authors use, as a viewer sees it', () => {
  it('says_who_uses_it_what_it_is_for_and_how_to_get_the_role', () => {
    render(
      <ViewerNotice what="Webhooks start workflows from other applications." />,
    );

    expect(
      screen.getByText('For editors and administrators'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Webhooks start workflows from other applications\./),
    ).toHaveTextContent('ask an administrator for the editor role.');
  });
});
