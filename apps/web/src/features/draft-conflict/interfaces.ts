export interface DraftConflictProps {
  readonly savedBy: string;
  readonly savedAt: string;
  readonly theirs: string;
  readonly base: string | null;
  readonly readMine: () => string;
  readonly onResolve: (text: string) => void;
}

export interface Resolution {
  readonly mine: string;
  readonly merged: string | null;
}
