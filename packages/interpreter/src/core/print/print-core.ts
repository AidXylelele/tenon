import type { Line } from "./line.js";
import { type PrintedProgram, programLinesOf } from "./program.js";

export function printProgram(program: PrintedProgram): string {
  const lines = programLinesOf(program);
  const texts = lines.flatMap((line) => textLinesOf(line, ""));

  return texts.join("\n");
}

function textLinesOf(line: Line, indentation: string): readonly string[] {
  const own = `${indentation}${line.text}`;
  const deeper = `${indentation}  `;
  const nested = line.children.flatMap((child) => textLinesOf(child, deeper));

  return [own, ...nested];
}
