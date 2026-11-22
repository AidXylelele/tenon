export type {
  ChosenResult,
  ResultMembers,
  ResultReading,
  ReturnMode,
  StepResult,
  WrittenResult,
} from "./interfaces.js";
export { startingContentOf } from "./contents.js";
export {
  isChosenResult,
  inputAndValuesAs,
  outputAsPointerOf,
  printedResultOf,
  resultChoicesOf,
  resultMembersOf,
  resultReadingOf,
  returnPointerOf,
  writtenResultOf,
} from "./results.js";
export {
  kindOf,
  type StepVariant,
  stepVariants,
  supportedVariantsOf,
  variantOf,
} from "./variants.js";
