import type {
  InstanceOrder,
  ListedInstance,
  Phase,
} from "@/libs/data-access/types";

export interface RunOrder {
  readonly sort: InstanceOrder;
  readonly hrefOf: (sort: InstanceOrder) => string;
}

export interface RunTableProps {
  readonly runs: readonly ListedInstance[];
  readonly Status: React.ComponentType<{ readonly phase: Phase }>;
  readonly showWorkflow?: boolean;
  readonly order?: RunOrder;
  readonly empty: React.ReactNode;
}

export interface RunPagerProps {
  readonly page: number;
  readonly size: number;
  readonly total: number;
  readonly exact: boolean;
  readonly hrefOf: (page: number, size: number) => string;
}

export type PageNumber =
  | { readonly kind: "page"; readonly page: number }
  | { readonly kind: "gap"; readonly key: string };

export interface PageSize {
  readonly size: number;
  readonly href: string;
}
