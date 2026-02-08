export const hashString = (input: unknown): string => {
  let hash = 5381;
  const str = String(input ?? '');
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash &= 0xffffffff;
  }
  return (hash >>> 0).toString(16);
};

