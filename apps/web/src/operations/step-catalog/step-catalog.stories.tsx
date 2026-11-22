import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { cn } from "cn";
import type { StepVariant } from "language-server/protocol";
import { type ChangeEvent, type KeyboardEvent, useState } from "react";
import { TENON_VARIANTS, WITHOUT_SHELL } from "./hosts.test-support";
import {
  catalogOf,
  entryWordsOf,
  foundText,
  type GroupId,
  keyboardOrderOf,
  noMatchOf,
  type ShownEntry,
  type ShownGroup,
  shownGroupsOf,
} from ".";

interface CatalogProbeProps {
  readonly variants: readonly StepVariant[];
  readonly stepAbove: string | null;
}

interface GroupOptionsProps {
  readonly group: ShownGroup;
  readonly current: ShownEntry | undefined;
  readonly terms: boolean;
  readonly stepAbove: string | null;
  readonly onChoose: (shown: ShownEntry) => void;
}

interface EntryOptionProps {
  readonly shown: ShownEntry;
  readonly current: ShownEntry | undefined;
  readonly terms: boolean;
  readonly stepAbove: string | null;
  readonly onChoose: (shown: ShownEntry) => void;
}

const NONE_OPENED: ReadonlySet<GroupId> = new Set();

const MOVES: ReadonlyMap<string, number> = new Map([
  ["ArrowDown", 1],
  ["ArrowUp", -1],
]);

function CatalogProbe({ variants, stepAbove }: CatalogProbeProps) {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState(NONE_OPENED);
  const [active, setActive] = useState(0);
  const [terms, setTerms] = useState(false);
  const [chosen, setChosen] = useState("Nothing chosen yet");

  const catalog = catalogOf(variants, stepAbove);
  const groups = shownGroupsOf(catalog, query, opened);
  const order = keyboardOrderOf(groups);
  const last = Math.max(order.length - 1, 0);
  const index = Math.min(active, last);
  const current = order[index];
  const activeId = current ? `option-${current.entry.id}` : undefined;
  const count = foundText(order.length);
  const open = groups.filter((group) => group.open);
  const closed = groups.filter((group) => !group.open);

  function search(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setActive(0);
  }

  function choose(shown: ShownEntry) {
    const action = JSON.stringify(shown.entry.action);
    const told = `${shown.entry.title} → ${action}`;
    setChosen(told);
  }

  function showTerms(event: ChangeEvent<HTMLInputElement>) {
    setTerms(event.target.checked);
  }

  function press(event: KeyboardEvent<HTMLInputElement>) {
    const entering = event.key === "Enter" && current !== undefined;
    const move = MOVES.get(event.key);
    if (entering) {
      event.preventDefault();
      choose(current);
      return;
    }
    if (move === undefined) return;

    event.preventDefault();
    const target = index + move;
    const floored = Math.max(target, 0);
    const moved = Math.min(floored, last);
    setActive(moved);
  }

  function openGroup(id: GroupId) {
    const next = new Set(opened);
    next.add(id);
    setOpened(next);
  }

  return (
    <div className="flex w-96 flex-col gap-3 p-4 text-sm">
      <input
        role="combobox"
        aria-expanded
        aria-controls="catalog-list"
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label="Find a kind of step"
        placeholder="Find a step: http, slack, if, loop, wait…"
        autoComplete="off"
        value={query}
        onChange={search}
        onKeyDown={press}
        className="rounded-md border px-3 py-2"
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={terms} onChange={showTerms} />
        Show language terms
      </label>
      <p role="status" className="text-muted-foreground">
        {count}
      </p>
      <div
        id="catalog-list"
        role="listbox"
        aria-label="Kinds of step"
        className="flex flex-col gap-3"
      >
        {open.map((group) => (
          <GroupOptions
            key={group.id}
            group={group}
            current={current}
            terms={terms}
            stepAbove={stepAbove}
            onChoose={choose}
          />
        ))}
      </div>
      {closed.map((group) => (
        <button
          key={group.id}
          type="button"
          aria-expanded={false}
          onClick={() => openGroup(group.id)}
          className="flex justify-between text-xs font-semibold uppercase text-muted-foreground"
        >
          {group.title}
          <span>{group.entries.length}</span>
        </button>
      ))}
      {groups.length === 0 ? <NoMatchNote query={query} /> : null}
      <output aria-label="Chosen" className="font-mono text-xs">
        {chosen}
      </output>
    </div>
  );
}

function GroupOptions({
  group,
  current,
  terms,
  stepAbove,
  onChoose,
}: GroupOptionsProps) {
  const headingId = `group-${group.id}`;

  return (
    <div role="group" aria-labelledby={headingId}>
      <div
        id={headingId}
        role="presentation"
        className="text-xs font-semibold uppercase text-muted-foreground"
      >
        {group.title}
      </div>
      {group.entries.map((shown) => (
        <EntryOption
          key={shown.entry.id}
          shown={shown}
          current={current}
          terms={terms}
          stepAbove={stepAbove}
          onChoose={onChoose}
        />
      ))}
    </div>
  );
}

function EntryOption({
  shown,
  current,
  terms,
  stepAbove,
  onChoose,
}: EntryOptionProps) {
  const { entry, termMatched } = shown;
  const active = shown === current;
  const words = entryWordsOf(entry, stepAbove);
  const showsTerm = terms || termMatched;
  const optionId = `option-${entry.id}`;
  const look = cn("rounded-md px-2 py-1.5", active && "bg-muted");

  return (
    <div
      id={optionId}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onClick={() => onChoose(shown)}
      className={look}
    >
      <span className="font-medium">{words.title}</span>
      {showsTerm ? (
        <code className="ml-2 text-xs text-muted-foreground">
          {entry.languageTerm}
        </code>
      ) : null}
      <span className="block text-muted-foreground">{words.description}</span>
      <span className="block text-xs">{entry.example}</span>
      <span className="block text-xs text-muted-foreground">
        icon {entry.icon}
      </span>
    </div>
  );
}

function NoMatchNote({ query }: { readonly query: string }) {
  const note = noMatchOf(query);

  return (
    <div role="note">
      <p>{note.message}</p>
      <p className="text-xs text-muted-foreground">{note.hint}</p>
    </div>
  );
}

const meta = {
  component: CatalogProbe,
} satisfies Meta<typeof CatalogProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tenon: Story = {
  args: { variants: TENON_VARIANTS, stepAbove: "Fetch the digest" },
};

export const WithoutShellOrContainer: Story = {
  args: { variants: WITHOUT_SHELL, stepAbove: null },
};
