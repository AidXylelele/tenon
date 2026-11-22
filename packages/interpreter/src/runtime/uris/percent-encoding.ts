const reservedLeftByUriComponent = /[!'()*]/g;

export function percentEncodedOf(text: string): string {
  const wellFormed = text.toWellFormed();
  const encoded = encodeURIComponent(wellFormed);

  return encoded.replaceAll(
    reservedLeftByUriComponent,
    percentEncodedCharacterOf,
  );
}

function percentEncodedCharacterOf(character: string): string {
  const code = character.charCodeAt(0);
  const hex = code.toString(16).toUpperCase();

  return `%${hex}`;
}
