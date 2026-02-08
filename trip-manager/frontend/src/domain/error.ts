export const getRequestErrorMessage = (error: any, fallbackText = '操作失败'): string => (
  error?.response?.data?.conflicts?.[0]?.message
    || error?.response?.data?.error
    || fallbackText
);

