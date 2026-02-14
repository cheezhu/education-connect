import { useEffect, useState } from 'react';
import { calcDurationHours } from '../utils/time';

const DEFAULT_PLAN_DURATION = 2;

const pick = (value, fallback) => (
  value === undefined || value === null || value === '' ? fallback : value
);

const normalizeManualLocationIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((id) => Number.isFinite(id) && id > 0);
};

const buildDesignerResources = (designerSourceList) => {
  const list = Array.isArray(designerSourceList) ? designerSourceList : [];
  return list
    .map((item) => {
      const locationId = Number(item?.locationId ?? item?.location_id);
      if (!Number.isFinite(locationId) || locationId <= 0) return null;

      const resourceId = pick(item?.resourceId ?? item?.resource_id, `plan-sync-${locationId}`);
      const startTime = item?.startTime ?? item?.start_time ?? null;
      const endTime = item?.endTime ?? item?.end_time ?? null;

      const title = pick(item?.title, item?.location ?? item?.locationName ?? item?.location_name ?? '行程点');
      const locationName = pick(item?.location, item?.locationName ?? item?.location_name ?? item?.title ?? '');
      const description = pick(item?.description, item?.address ?? '');
      const color = pick(item?.color, item?.locationColor ?? item?.location_color ?? null);

      return {
        id: resourceId,
        type: item?.type || 'visit',
        title,
        icon: '',
        duration: calcDurationHours(startTime, endTime, DEFAULT_PLAN_DURATION * 60),
        description,
        isUnique: true,
        locationId,
        locationName,
        location: locationName,
        locationColor: color,
        planId: null
      };
    })
    .filter(Boolean);
};

const buildPlanTemplateResources = (selectedPlan) => {
  if (!selectedPlan || !Array.isArray(selectedPlan.items)) return [];
  return [...selectedPlan.items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => {
      const locationId = Number(item.location_id ?? item.locationId);
      if (!Number.isFinite(locationId) || locationId <= 0) return null;

      const locationName = item.location_name ?? item.locationName ?? '';
      const address = item.address ?? '';
      const capacity = Number(item.capacity ?? 0) || 0;
      const color = item.location_color ?? item.locationColor ?? null;
      const resolvedName = locationName || `行程点 ${locationId}`;

      return {
        id: `plan-${selectedPlan.id}-loc-${locationId}`,
        type: 'visit',
        title: resolvedName,
        icon: '',
        duration: DEFAULT_PLAN_DURATION,
        description: address ? `${address} · 容量${capacity}人` : `容量${capacity}人`,
        isUnique: true,
        locationId,
        locationName: resolvedName,
        location: resolvedName,
        locationColor: color,
        planId: selectedPlan.id
      };
    })
    .filter(Boolean);
};

const buildManualResources = (manualMustVisitLocationIds, locations) => {
  const ids = normalizeManualLocationIds(manualMustVisitLocationIds);
  if (ids.length === 0) return [];

  const locationMap = new Map(
    (Array.isArray(locations) ? locations : [])
      .map((loc) => [Number(loc.id), loc])
      .filter(([id]) => Number.isFinite(id) && id > 0)
  );

  return ids
    .map((locationId) => {
      const location = locationMap.get(locationId) || {};
      const locationName = pick(
        location.name,
        pick(location.location_name, pick(location.locationName, `行程点 ${locationId}`))
      );
      const address = pick(location.address, '');
      const capacity = Number(location.capacity ?? 0) || 0;
      const color = pick(location.color, pick(location.location_color, null));

      return {
        id: `plan-manual-loc-${locationId}`,
        type: 'visit',
        title: locationName,
        icon: '',
        duration: DEFAULT_PLAN_DURATION,
        description: address ? `${address} · 容量${capacity}人` : (capacity > 0 ? `容量${capacity}人` : ''),
        isUnique: true,
        locationId,
        locationName,
        location: locationName,
        locationColor: color,
        planId: null
      };
    })
    .filter(Boolean);
};

const useCalendarDetailMustVisitPool = ({
  selectedPlanId,
  itineraryPlans,
  designerSourceList,
  manualMustVisitLocationIds,
  locations,
  activities,
  schedules
}) => {
  const [planResources, setPlanResources] = useState([]);
  const [availablePlanResources, setAvailablePlanResources] = useState([]);

  useEffect(() => {
    const designerResources = buildDesignerResources(designerSourceList);
    if (designerResources.length > 0) {
      setPlanResources(designerResources);
      return;
    }

    const selectedPlanIdKey = selectedPlanId == null ? null : String(selectedPlanId);
    const selectedPlan = Array.isArray(itineraryPlans) && selectedPlanIdKey
      ? itineraryPlans.find((plan) => String(plan.id) === selectedPlanIdKey)
      : null;
    const planTemplateResources = buildPlanTemplateResources(selectedPlan);
    if (planTemplateResources.length > 0) {
      setPlanResources(planTemplateResources);
      return;
    }

    const manualResources = buildManualResources(manualMustVisitLocationIds, locations);
    setPlanResources(manualResources);
    if (manualResources.length === 0) {
      setAvailablePlanResources([]);
    }
  }, [selectedPlanId, itineraryPlans, designerSourceList, manualMustVisitLocationIds, locations]);

  useEffect(() => {
    // `activities` is local source-of-truth for currently scheduled resources.
    // Keep `schedules` in deps for compatibility with parent refresh timing.
    const sourceActivities = Array.isArray(activities) ? activities : [];
    const usedResourceIds = new Set();
    const usedLocationIds = new Set();

    sourceActivities.forEach((activity) => {
      const resourceId = activity?.resourceId ?? activity?.resource_id;
      if (resourceId) usedResourceIds.add(resourceId);
      const locationId = Number(activity?.locationId ?? activity?.location_id);
      if (Number.isFinite(locationId) && locationId > 0) usedLocationIds.add(locationId);
    });

    setAvailablePlanResources(
      planResources.filter((resource) => {
        if (usedResourceIds.has(resource.id)) return false;
        const resourceLocationId = Number(resource.locationId);
        if (Number.isFinite(resourceLocationId) && usedLocationIds.has(resourceLocationId)) {
          return false;
        }
        return true;
      })
    );
  }, [planResources, schedules, activities]);

  return {
    planResources,
    availablePlanResources,
    setAvailablePlanResources
  };
};

export default useCalendarDetailMustVisitPool;
