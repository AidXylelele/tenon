import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Command,
  CommandInput,
  CommandList,
} from '@/libs/ui/components/command';
import type { FoundWorkflow } from './actions';
import { useWorkflowSearch, WorkflowResults } from './workflow-results';

const searchable = vi.fn<() => Promise<FoundWorkflow[]>>();
const onGo = vi.fn<(href: string) => void>();

vi.mock('./actions', () => ({
  searchableWorkflowsAction: () => searchable(),
}));

const lead: FoundWorkflow = {
  namespace: 'sales',
  name: 'route-lead',
  on: true,
};
const charge: FoundWorkflow = {
  namespace: 'billing',
  name: 'charge-card',
  on: false,
};

// A search as a palette holds it: opened by a button, its results in a command list.
function Search() {
  const search = useWorkflowSearch();

  return (
    <>
      <button type="button" onClick={search.read}>
        Open
      </button>
      <Command>
        <CommandInput placeholder="Type a workflow" />
        <CommandList>
          <WorkflowResults search={search} onGo={onGo} />
        </CommandList>
      </Command>
    </>
  );
}

// An answer the test gives when it chooses.
function deferred(): {
  readonly promise: Promise<FoundWorkflow[]>;
  readonly resolve: (found: FoundWorkflow[]) => void;
} {
  let resolve: (found: FoundWorkflow[]) => void = () => undefined;
  const promise = new Promise<FoundWorkflow[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('the workflows the search offers', () => {
  beforeEach(() => {
    searchable.mockReset();
    onGo.mockReset();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('nothing_is_read_before_the_search_opens', () => {
    render(<Search />);

    expect(searchable).not.toHaveBeenCalled();
    expect(screen.queryByText('Reading workflows…')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('a_line_says_they_are_read_until_the_first_answer_comes', async () => {
    const answer = deferred();
    searchable.mockReturnValue(answer.promise);
    render(<Search />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const readingFirst = screen.queryByText('Reading workflows…') !== null;
    await act(async () => answer.resolve([lead]));

    expect(readingFirst).toBe(true);
    expect(screen.queryByText('Reading workflows…')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /route-lead/ })).toBeVisible();
  });

  it('each_workflow_shows_its_name_its_namespace_and_whether_it_is_on', async () => {
    searchable.mockResolvedValue([lead, charge]);
    render(<Search />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const on = await screen.findByRole('option', { name: /route-lead/ });
    const off = screen.getByRole('option', { name: /charge-card/ });

    expect(on).toHaveTextContent('route-leadsalesOn');
    expect(off).toHaveTextContent('charge-cardbilling');
    expect(off).not.toHaveTextContent('On');
  });

  it('a_workflow_opens_its_page', async () => {
    searchable.mockResolvedValue([lead]);
    render(<Search />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(await screen.findByRole('option', { name: /route-lead/ }));

    expect(onGo).toHaveBeenCalledWith('/workflows/sales/route-lead');
  });

  it('a_workflow_is_found_by_its_namespace_as_well_as_its_name', async () => {
    searchable.mockResolvedValue([lead, charge]);
    render(<Search />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('option', { name: /route-lead/ });
    fireEvent.change(screen.getByPlaceholderText('Type a workflow'), {
      target: { value: 'billing' },
    });

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('charge-card');
  });

  it('each_opening_reads_them_again_and_keeps_the_last_list_meanwhile', async () => {
    const again = deferred();
    searchable.mockResolvedValueOnce([lead]).mockReturnValueOnce(again.promise);
    render(<Search />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('option', { name: /route-lead/ });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const meanwhile = screen.getAllByRole('option').length;
    const readingAgain = screen.queryByText('Reading workflows…') !== null;
    await act(async () => again.resolve([lead, charge]));

    expect(searchable).toHaveBeenCalledTimes(2);
    expect(meanwhile).toBe(1);
    expect(readingAgain).toBe(false);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
