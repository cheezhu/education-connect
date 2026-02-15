import { useCallback, useMemo } from 'react';
import message from 'antd/es/message';
import { hashString } from '../utils/hash';
import { calcDurationMinutes } from '../utils/time';
import { isPlanResourceId } from '../../../../domain/resourceId';
import { CALENDAR_DETAIL_MESSAGES } from '../../messages';

const useCalendarDetailCustomResources = ({
  customResourcesInput,
  activities,
  onCustomResourcesChange
}) => {
  const customResources = useMemo(() => (
    Array.isArray(customResourcesInput) ? customResourcesInput : []
  ), [customResourcesInput]);

  const availableCustomResources = useMemo(() => {
    const usedResourceIds = new Set();
    (activities || []).forEach((activity) => {
      const resourceId = activity?.resourceId ?? activity?.resource_id;
      if (typeof resourceId === 'string' && resourceId.length > 0) {
        usedResourceIds.add(resourceId);
        return;
      }

      // Backward-compat: legacy custom schedules might not have `resourceId` yet.
      // Hide the matching custom resource card by deriving its id deterministically.
      const planItemId = activity?.planItemId;
      if (planItemId) return;
      const locationPlanId = isPlanResourceId(activity?.resourceId) ? activity.resourceId : '';
      if (locationPlanId) return;

      const typeKey = activity?.type || 'activity';
      const titleKey = activity?.title || activity?.location || '自定义活动';
      const durationMinutes = calcDurationMinutes(activity?.startTime, activity?.endTime, 60);
      const hash = hashString(`${typeKey}|${titleKey}|${durationMinutes}`);
      usedResourceIds.add(`custom:${hash}`);
    });

    return customResources.filter((resource) => !usedResourceIds.has(resource.id));
  }, [customResources, activities]);

  const handleDeleteCustomResource = useCallback((resourceId) => {
    if (!resourceId) return;
    if (!onCustomResourcesChange) {
      message.warning(CALENDAR_DETAIL_MESSAGES.customDeleteUnavailable);
      return;
    }
    const next = customResources.filter((item) => item?.id !== resourceId);
    onCustomResourcesChange(next);
    message.success(CALENDAR_DETAIL_MESSAGES.customDeleteSuccess, 1);
  }, [customResources, onCustomResourcesChange]);

  return {
    customResources,
    availableCustomResources,
    handleDeleteCustomResource
  };
};

export default useCalendarDetailCustomResources;
