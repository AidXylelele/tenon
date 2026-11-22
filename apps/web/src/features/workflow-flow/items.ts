export const START = "start";

export const END = "end";

export const START_ITEM = stepItemOf(START);

export function stepItemOf(target: string): string {
  return `step:${target}`;
}

export function plusItemOf(list: string, index: number): string {
  return `plus:${list}:${String(index)}`;
}

export function branchItemOf(step: string, name: string): string {
  return `branch:${step}:${name}`;
}

export function branchPlusItemOf(step: string, name: string): string {
  return `branch-plus:${step}:${name}`;
}

export function menuItemOf(step: string): string {
  return `menu:${step}`;
}

export function iterationItemOf(step: string, which: string): string {
  return `iteration:${step}:${which}`;
}
