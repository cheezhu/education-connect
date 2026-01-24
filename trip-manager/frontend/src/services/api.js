import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

const resolveAuthHeader = () => {
  const rawAuth = import.meta.env.VITE_API_BASIC_AUTH;
  const envUser = import.meta.env.VITE_API_USER;
  const envPassword = import.meta.env.VITE_API_PASSWORD;

  if (rawAuth) {
    if (rawAuth.includes(':')) {
      return `Basic ${btoa(rawAuth)}`;
    }
    return `Basic ${rawAuth}`;
  }

  const username = envUser || 'admin';
  const password = envPassword || 'admin123';
  return `Basic ${btoa(`${username}:${password}`)}`;
};

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加基础认证头（可通过 VITE_API_* 覆盖）
    config.headers.Authorization = resolveAuthHeader();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API请求失败:', error);
    return Promise.reject(error);
  }
);

export default api;
