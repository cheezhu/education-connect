const DEFAULT_DELIMITER = /[,\uFF0C\u3001;|\uFF5C]/;

export type ParseDelimitedOptions = {
  delimiter?: RegExp;
  dedupe?: boolean;
  keepEmpty?: boolean;
  trim?: boolean;
};

export const parseDelimited = (value: unknown, options: ParseDelimitedOptions = {}): string[] => {
  const {
    delimiter = DEFAULT_DELIMITER,
    dedupe = false,
    keepEmpty = false,
    trim = true
  } = options;

  const parts = String(value || '')
    .split(delimiter)
    .map((item) => (trim ? String(item).trim() : String(item)))
    .filter((item) => (keepEmpty ? true : Boolean(item)));

  if (!dedupe) return parts;

  const seen = new Set<string>();
  const out: string[] = [];
  parts.forEach((item) => {
    if (seen.has(item)) return;
    seen.add(item);
    out.push(item);
  });
  return out;
};

// Kept for backward compatibility. Both map to the same implementation by default.
export const parseDelimitedValues = (value: unknown): string[] => parseDelimited(value);
export const parseDelimitedList = (value: unknown): string[] => parseDelimited(value);

export const parseDelimitedIdList = (value: unknown): number[] => (
  parseDelimitedList(value)
    .map((item) => Number(item))
    .filter((id) => Number.isFinite(id) && id > 0)
);

