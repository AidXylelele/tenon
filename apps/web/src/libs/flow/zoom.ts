import type { Size } from "./interfaces";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.5;
const FULL_SIZE = 1;
const ZOOM_STEP = 1.25;

export function fitWidthOf(flow: Size, view: Size): number {
  const across = view.width / flow.width;

  return zoomWithin(across, FULL_SIZE);
}

export function fitOf(flow: Size, view: Size): number {
  const across = view.width / flow.width;
  const down = view.height / flow.height;
  const both = Math.min(across, down);

  return zoomWithin(both, FULL_SIZE);
}

export function zoomInOf(zoom: number): number {
  const larger = zoom * ZOOM_STEP;

  return zoomWithin(larger, MAX_ZOOM);
}

export function zoomOutOf(zoom: number): number {
  const smaller = zoom / ZOOM_STEP;

  return zoomWithin(smaller, MAX_ZOOM);
}

export function isSmallestZoom(zoom: number): boolean {
  return zoom <= MIN_ZOOM;
}

export function isLargestZoom(zoom: number): boolean {
  return zoom >= MAX_ZOOM;
}

function zoomWithin(zoom: number, largest: number): number {
  const capped = Math.min(zoom, largest);

  return Math.max(capped, MIN_ZOOM);
}
