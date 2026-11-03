// The RFC 6570 URI template format. ajv-formats' refuses a dotted variable name (`{pet.id}`),
// which RFC 6570 §2.3 allows: varname = varchar *( ["."] varchar ).
export class UriTemplate {
  static readonly #VARCHAR = '(?:[a-z0-9_]|%[0-9a-f]{2})';
  static readonly #VARNAME = `${UriTemplate.#VARCHAR}(?:\\.?${UriTemplate.#VARCHAR})*`;
  static readonly #VARSPEC = `${UriTemplate.#VARNAME}(?::[1-9][0-9]{0,3}|\\*)?`;
  static readonly #EXPRESSION = `\\{[+#./;?&=,!@|]?${UriTemplate.#VARSPEC}(?:,${UriTemplate.#VARSPEC})*\\}`;
  static readonly #LITERAL = `[^\\x00-\\x20"'<>%\\\\^\`{|}]|%[0-9a-f]{2}`;

  static readonly FORMAT = new RegExp(
    `^(?:${UriTemplate.#LITERAL}|${UriTemplate.#EXPRESSION})*$`,
    'iu',
  );
}
