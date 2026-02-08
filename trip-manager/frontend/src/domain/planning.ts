export const triggerDownload = (blob: Blob, filename: string): void => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const extractPlanningAssignments = (payload: any): any[] => (
  payload && Array.isArray(payload.assignments) ? payload.assignments : []
);

export const extractPlanningGroupIds = (payload: any): number[] => {
  const ids = extractPlanningAssignments(payload)
    .map((item) => Number(item?.groupId ?? item?.group_id))
    .filter(Number.isFinite);
  return Array.from(new Set(ids));
};

export const extractPlanningRange = (payload: any): { start: string; end: string } | null => {
  if (!payload) return null;
  const range = payload.range || {};
  const start = range.startDate || range.start_date;
  const end = range.endDate || range.end_date;
  if (start && end) {
    return { start, end };
  }
  const dates = extractPlanningAssignments(payload)
    .map((item) => item?.date)
    .filter(Boolean)
    .sort();
  if (!dates.length) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
};

export const buildPlanningImportValidationKey = (payload: any, options: any): string => JSON.stringify({
  snapshot: payload?.snapshot_id || '',
  assignments: extractPlanningAssignments(payload).length,
  groupIds: (options.groupIds || []).map((id: any) => Number(id)).filter(Number.isFinite).sort((a: number, b: number) => a - b),
  replaceExisting: Boolean(options.replaceExisting),
  skipConflicts: Boolean(options.skipConflicts),
  startDate: options.startDate || '',
  endDate: options.endDate || ''
});
