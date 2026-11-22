export type {
  ChosenResult,
  ResultMembers,
  ResultReading,
  StepResult,
  WrittenResult,
} from "./interfaces.js";
export { startingContentOf } from "./contents.js";
export {
  isChosenResult,
  isReturnedAs,
  outputAsPointerOf,
  resultChoicesOf,
  resultMembersOf,
  resultReadingOf,
  returnPointerOf,
  writtenResultOf,
} from "./results.js";
export {
  type StepVariant,
  stepVariants,
  supportedVariantsOf,
  variantOf,
} from "./variants.js";
