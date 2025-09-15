import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加基础认证头
    const credentials = btoa('admin:admin123'); // 默认管理员账号
    config.headers.Authorization = `Basic ${credentials}`;
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