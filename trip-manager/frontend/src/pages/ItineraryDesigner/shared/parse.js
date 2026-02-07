export const parseDelimitedValues = (value) => (
  String(value || '')
    .split(/[,\uFF0C\u3001;|\uFF5C]/)
    .map(item => item.trim())
    .filter(Boolean)
);

export const parseDelimitedList = (value) => (
  String(value || '')
    .split(/[,\uFF0C\u3001;|\uFF5C]/)
    .map(item => item.trim())
    .filter(Boolean)
);

export const parseDelimitedIdList = (value) => (
  parseDelimitedList(value)
    .map(item => Number(item))
    .filter(id => Number.isFinite(id) && id > 0)
);

