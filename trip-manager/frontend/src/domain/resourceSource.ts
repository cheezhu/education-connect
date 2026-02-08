import { getResourceId, resolveResourceKind, type ResourceKind } from './resourceId';

export type ResourceSourceMeta = {
  kind: ResourceKind;
  tag: string; // 2 chars in UI: 必去/食行/其他
  title: string;
  className: string; // used by CSS: source-plan/source-shixing/source-custom
};

export const resolveSourceMetaByKind = (kind: ResourceKind): ResourceSourceMeta => {
  switch (kind) {
    case 'plan':
      return { kind, tag: '必去', title: '必去行程点', className: 'source-plan' };
    case 'shixing':
      return { kind, tag: '食行', title: '食行卡片', className: 'source-shixing' };
    case 'custom':
    case 'unknown':
    default:
      return { kind: 'custom', tag: '其他', title: '其他', className: 'source-custom' };
  }
};

// Accepts either a resourceId string or an activity-like object.
// `planItemId` is treated as plan when the resourceId is missing (backward compat).
export const resolveSourceMeta = (input: unknown): ResourceSourceMeta => {
  const resourceId = typeof input === 'string' ? input : getResourceId(input);
  let kind = resolveResourceKind(resourceId);

  if (kind === 'unknown' && input && typeof input === 'object') {
    const anyInput = input as any;
    if (anyInput.planItemId) kind = 'plan';
  }

  return resolveSourceMetaByKind(kind);
};

