export const buildClientId = () => (
  `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

