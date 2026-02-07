import { useEffect, useState } from 'react';
import { calcDurationHours } from '../utils/time';

const DEFAULT_PLAN_DURATION = 2;

const pick = (value, fallback) => (value === undefined || value === null || value === '' ? fallback : value);

const useMustVisitPool = ({
  selectedPlanId,
  itineraryPlans,
  designerSourceList,
  activities,
  schedules
}) => {
  const [planResources, setPlanResources] = useState([]);
  const [availablePlanResources, setAvailablePlanResources] = useState([]);

  useEffect(() => {
    // Prefer the group-specific "designer plan items" as must-visit resources.
    // If the designer has no plan items yet, fall back to the selected itinerary template.
    const designerList = Array.isArray(designerSourceList) ? designerSourceList : [];
    const designerResources = designerList
      .map((item) => {
        const locationIdRaw = item?.locationId ?? item?.location_id;
        const locationId = Number(locationIdRaw);
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

    if (designerResources.length > 0) {
      setPlanResources(designerResources);
      return;
    }

    const selectedPlanIdKey = selectedPlanId == null ? null : String(selectedPlanId);
    const selectedPlan = Array.isArray(itineraryPlans) && selectedPlanIdKey
      ? itineraryPlans.find((plan) => String(plan.id) === selectedPlanIdKey)
      : null;

    if (!selectedPlan || !Array.isArray(selectedPlan.items)) {
      setPlanResources([]);
      setAvailablePlanResources([]);
      return;
    }

    const resources = [...selectedPlan.items]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((item) => {
        const locationId = item.location_id ?? item.locationId;
        const locationName = item.location_name ?? item.locationName ?? '';
        const address = item.address ?? '';
        const capacity = item.capacity ?? 0;
        const color = item.location_color ?? item.locationColor ?? null;

        return {
          id: `plan-${selectedPlan.id}-loc-${locationId}`,
          type: 'visit',
          title: locationName,
          icon: '',
          duration: DEFAULT_PLAN_DURATION,
          description: address
            ? `${address} · 容量${capacity}人`
            : `容量${capacity}人`,
          isUnique: true,
          locationId,
          locationName,
          location: locationName,
          locationColor: color,
          planId: selectedPlan.id
        };
      });

    setPlanResources(resources);
  }, [selectedPlanId, itineraryPlans, designerSourceList]);

  useEffect(() => {
    // `activities` is the local source-of-truth for what's currently on the calendar.
    // Do not fall back to `schedules` here; otherwise "重置行程" can keep hiding plan items
    // until the parent finishes saving and reloading schedules.
    const sourceActivities = Array.isArray(activities) ? activities : [];
    const usedResourceIds = new Set();
    const usedLocationIds = new Set();

    sourceActivities.forEach((activity) => {
      const resourceId = activity?.resourceId ?? activity?.resource_id;
      if (resourceId) {
        usedResourceIds.add(resourceId);
      }
      const locationId = Number(activity?.locationId ?? activity?.location_id);
      if (Number.isFinite(locationId)) {
        usedLocationIds.add(locationId);
      }
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

export default useMustVisitPool;
