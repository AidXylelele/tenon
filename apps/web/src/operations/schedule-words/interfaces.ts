export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeOfDay {
  readonly hour: number;
  readonly minute: number;
}

export type Repeat =
  | { readonly kind: "daily"; readonly at: TimeOfDay }
  | { readonly kind: "weekdays"; readonly at: TimeOfDay }
  | { readonly kind: "hourly"; readonly minute: number }
  | { readonly kind: "minutes"; readonly every: number }
  | {
      readonly kind: "weekly";
      readonly days: readonly Weekday[];
      readonly at: TimeOfDay;
    }
  | { readonly kind: "custom"; readonly cron: string };

export interface CronTable {
  readonly minutes: readonly number[];
  readonly hours: readonly number[];
  readonly times: readonly number[];
  readonly days: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly weekdays: ReadonlySet<number>;
  readonly daysRestricted: boolean;
  readonly weekdaysRestricted: boolean;
}
