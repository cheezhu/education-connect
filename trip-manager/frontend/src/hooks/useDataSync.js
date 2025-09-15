import { useState, useCallback } from 'react';

// 全局数据同步钩子
let globalRefreshTrigger = 0;
const refreshCallbacks = new Set();

const useDataSync = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(globalRefreshTrigger);

  // 注册刷新回调
  const registerRefreshCallback = useCallback((callback) => {
    refreshCallbacks.add(callback);

    // 返回取消注册函数
    return () => {
      refreshCallbacks.delete(callback);
    };
  }, []);

  // 触发全局数据刷新
  const triggerGlobalRefresh = useCallback(() => {
    globalRefreshTrigger += 1;

    // 通知所有注册的组件刷新数据
    refreshCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in refresh callback:', error);
      }
    });

    // 更新本地状态以触发重渲染
    setRefreshTrigger(globalRefreshTrigger);
  }, []);

  return {
    refreshTrigger,
    registerRefreshCallback,
    triggerGlobalRefresh
  };
};

export default useDataSync;