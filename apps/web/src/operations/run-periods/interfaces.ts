export type Period = "24h" | "7d" | "30d";

export type Started = Period | "all";

export type RunStatus = "in-progress" | "succeeded" | "failed" | "cancelled";

export type BucketUnit = "hour" | "day";

export interface TimeWindow {
  readonly from: string;
  readonly to: string;
}

export interface Bucket extends TimeWindow {
  readonly label: string;
}

export interface PeriodWindows {
  readonly current: TimeWindow;
  readonly previous: TimeWindow;
  readonly unit: BucketUnit;
  readonly buckets: readonly Bucket[];
}
