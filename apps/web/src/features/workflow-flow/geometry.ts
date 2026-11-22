import type { JumpBoxes, JumpLine } from "./interfaces";

const LANE_GAP = 24;
const LANE_SPACING = 10;
const ENTRY_DROP = 24;
const ARROW_GAP = 3;
const ARROW_LENGTH = 6;
const ARROW_HALF = 4;
const SIDE_ROOM = 64;

export function jumpLineOf(boxes: JumpBoxes): JumpLine {
  const { jump, source, target, between } = boxes;
  const rights = between.map((box) => box.right);
  const widest = Math.max(source.right, target.right, ...rights);
  const lane = widest + LANE_GAP + jump.lane * LANE_SPACING;
  const from = (source.top + source.bottom) / 2;
  const into = target.top + ENTRY_DROP;
  const point = target.right + ARROW_GAP;
  const barb = point + ARROW_LENGTH;
  const end = point + ARROW_GAP;
  const path = `M ${String(source.right)} ${String(from)} H ${String(lane)} V ${String(into)} H ${String(end)}`;
  const arrow = `M ${String(barb)} ${String(into - ARROW_HALF)} L ${String(point)} ${String(into)} L ${String(barb)} ${String(into + ARROW_HALF)}`;

  return { key: jump.key, path, arrow };
}

export function sideRoomOf(lanes: number): number {
  return SIDE_ROOM + lanes * LANE_SPACING;
}
