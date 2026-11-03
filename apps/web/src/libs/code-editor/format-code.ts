import type { CodeLanguage } from './languages';

// The code laid out the standard way: JavaScript by Prettier, loaded the first time it is
// asked for (research R17), JSON by its own printer. Python has no formatter that runs in a
// browser, and YAML here is a document whose comments a printer would lose, so neither is
// offered.
export function formattable(language: CodeLanguage): boolean {
  return language === 'javascript' || language === 'json';
}

export async function formatCode(
  code: string,
  language: CodeLanguage,
): Promise<string> {
  if (language === 'json') {
    const value: unknown = JSON.parse(code);
    return JSON.stringify(value, null, 2);
  }

  const [prettier, babel, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);
  return prettier.format(code, { parser: 'babel', plugins: [babel, estree] });
}
