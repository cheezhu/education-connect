export const getRequestErrorMessage = (error, fallbackText = '操作失败') => (
  error?.response?.data?.conflicts?.[0]?.message
    || error?.response?.data?.error
    || fallbackText
);

