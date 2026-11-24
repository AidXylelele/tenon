export interface Page<T> {
  readonly items: T[];
  readonly next: string | null;
}

export interface Created {
  readonly id: string;
}

export interface Problem {
  readonly type: string;
  readonly errors: {
    readonly pointer: string;
    readonly code?: string;
    readonly detail?: string;
  }[];
}
