import {
  type Binders,
  argumentMeaning,
  binderMeaning,
} from "../forms/index.js";
import type { StaticFrame } from "./types.js";

export const inputFrame: StaticFrame = [argumentMeaning({ argument: "input" })];

export const outputFrame: StaticFrame = [
  argumentMeaning({ argument: "output" }),
];

export function binderFrameOf(binders: Binders): StaticFrame {
  return binders.slots.map((slot) =>
    binderMeaning({ declaration: binders.declaration, role: slot.role }),
  );
}
