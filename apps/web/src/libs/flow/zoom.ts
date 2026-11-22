import type { Size } from "./interfaces";

const STEPS: readonly number[] = [0.75, 1, 1.25, 1.5];
const SMALLEST = 0.75;
const LARGEST = 1.5;
const FULL_SIZE = 1;
const NEAR = 0.001;

const percent = new Intl.NumberFormat("en-GB", { style: "percent" });

export function fitWidthOf(content: Size, view: Size): number {
  const across = view.width / content.width;

  return fittedOf(across);
}

export function fitOf(content: Size, view: Size): number {
  const across = view.width / content.width;
  const down = view.height / content.height;
  const both = Math.min(across, down);

  return fittedOf(both);
}

export function zoomInOf(zoom: number): number {
  const larger = STEPS.find((step) => step > zoom + NEAR);

  return larger ?? LARGEST;
}

export function zoomOutOf(zoom: number): number {
  const smaller = STEPS.findLast((step) => step < zoom - NEAR);

  return smaller ?? SMALLEST;
}

export function isSmallestZoom(zoom: number): boolean {
  return zoom <= SMALLEST + NEAR;
}

export function isLargestZoom(zoom: number): boolean {
  return zoom >= LARGEST - NEAR;
}

export function zoomLevelOf(zoom: number): string {
  return percent.format(zoom);
}

export function centredScrollOf(
  scroll: number,
  viewport: number,
  from: number,
  to: number,
): number {
  const centre = scroll + viewport / 2;
  const scaled = centre * (to / from);

  return scaled - viewport / 2;
}

function fittedOf(zoom: number): number {
  const capped = Math.min(zoom, FULL_SIZE);

  return Math.max(capped, SMALLEST);
}
