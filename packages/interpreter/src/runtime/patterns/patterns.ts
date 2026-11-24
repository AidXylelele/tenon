export function compiledPatternOf(pattern: string): RegExp | null {
  const isValid = isRegularExpression(pattern);

  if (!isValid) {
    return null;
  }

  return new RegExp(`^(?:${pattern})$`, "u");
}

function isRegularExpression(source: string): boolean {
  try {
    new RegExp(source, "u");
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }

    throw error;
  }
}
