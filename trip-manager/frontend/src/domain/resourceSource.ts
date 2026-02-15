import { getResourceId, resolveResourceKind, type ResourceKind } from './resourceId';
import { RESOURCE_SOURCE_META } from '../../../shared/domain/groupMeta.mjs';

export type ResourceSourceMeta = {
  kind: ResourceKind;
  tag: string;
  title: string;
  className: string;
};

const SOURCE_META = RESOURCE_SOURCE_META as Record<ResourceKind, ResourceSourceMeta>;

export const resolveSourceMetaByKind = (kind: ResourceKind): ResourceSourceMeta => {
  if (kind === 'unknown') {
    return { ...SOURCE_META.custom };
  }
  return { ...SOURCE_META[kind] };
};

export const resolveSourceMeta = (input: unknown): ResourceSourceMeta => {
  const resourceId = typeof input === 'string' ? input : getResourceId(input);
  let kind = resolveResourceKind(resourceId);

  if (kind === 'unknown' && input && typeof input === 'object') {
    const maybeActivity = input as { planItemId?: unknown };
    if (maybeActivity.planItemId) {
      kind = 'plan';
    }
  }

  return resolveSourceMetaByKind(kind);
};
