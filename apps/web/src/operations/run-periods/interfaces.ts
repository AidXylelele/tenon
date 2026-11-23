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

export type FigureKind = "started" | "succeeded" | "failed" | "cancelled";

export interface Figure {
  readonly kind: FigureKind;
  readonly count: number;
  readonly previous: number | null;
}

export interface Bar extends Bucket {
  readonly succeeded: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly inProgress: number;
}

export interface CountRequest {
  readonly buckets: readonly string[];
  readonly to: string;
  readonly previousFrom: string;
}
