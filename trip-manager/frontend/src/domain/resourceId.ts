// Frontend keeps importing from "@/domain" stable, but runtime truth comes from ../shared so
// backend + frontend stay in sync.
//
// Vite dev server is configured to allow importing from ../shared in `frontend/vite.config.js`.
// eslint-disable-next-line import/no-unresolved
import * as sharedResourceId from '../../../shared/domain/resourceId.mjs';

export type ResourceId = string;

export type PlanResourceId = ResourceId; // plan-* / plan-sync-*
export type ShixingResourceId = ResourceId; // daily:*
export type CustomResourceId = ResourceId; // custom:*

export type ResourceKind = 'plan' | 'shixing' | 'custom' | 'unknown';

export type ShixingCategory = 'meal' | 'pickup' | 'dropoff' | string;

export type ParsedShixingResourceId = {
  date: string;
  category: ShixingCategory;
  key?: string;
};

type SharedResourceId = {
  getResourceId: (obj: unknown) => string;
  isPlanResourceId: (resourceId: unknown) => boolean;
  isShixingResourceId: (resourceId: unknown) => boolean;
  isCustomResourceId: (resourceId: unknown) => boolean;
  resolveResourceKind: (resourceId: unknown) => ResourceKind;
  buildShixingResourceId: (date: string, category: ShixingCategory, key?: string) => string;
  parseShixingResourceId: (resourceId: unknown) => ParsedShixingResourceId | null;
};

const shared = sharedResourceId as unknown as SharedResourceId;

export const getResourceId = (obj: unknown): string => shared.getResourceId(obj);

export const isPlanResourceId = (resourceId: unknown): resourceId is PlanResourceId => (
  shared.isPlanResourceId(resourceId)
);

export const isShixingResourceId = (resourceId: unknown): resourceId is ShixingResourceId => (
  shared.isShixingResourceId(resourceId)
);

export const isCustomResourceId = (resourceId: unknown): resourceId is CustomResourceId => (
  shared.isCustomResourceId(resourceId)
);

export const resolveResourceKind = (resourceId: unknown): ResourceKind => (
  shared.resolveResourceKind(resourceId)
);

export const buildShixingResourceId = (
  date: string,
  category: ShixingCategory,
  key?: string
): ShixingResourceId => (
  shared.buildShixingResourceId(date, category, key) as ShixingResourceId
);

export const parseShixingResourceId = (resourceId: unknown): ParsedShixingResourceId | null => (
  shared.parseShixingResourceId(resourceId)
);

