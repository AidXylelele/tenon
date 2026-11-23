export type {
  ComparingRow,
  Comparison,
  Condition,
  ConditionReading,
  ConditionRow,
  ConditionText,
  Join,
  Literal,
  Operand,
  SecondValue,
} from "./interfaces.js";
export { isPathOf, pathSource } from "./patterns.js";
export { conditionOf } from "./read.js";
export { conditionTextOf, secondValues } from "./write.js";
