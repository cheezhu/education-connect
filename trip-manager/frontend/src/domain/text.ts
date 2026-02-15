const ESCAPED_UNICODE_MARKER = /\\+u[0-9a-fA-F]{4}/;
const ESCAPED_UNICODE_RE = /\\+u([0-9a-fA-F]{4})/g;

export const decodeEscapedUnicode = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!ESCAPED_UNICODE_MARKER.test(text)) return text;
  return text.replace(ESCAPED_UNICODE_RE, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
};

export const toTrimmedDisplayText = (value: unknown): string => decodeEscapedUnicode(value).trim();
