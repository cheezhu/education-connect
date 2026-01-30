import axios from 'axios';

const STORAGE_KEY = 'ec_basic_auth';

const client = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const buildBasicAuth = (username, password) => (
  `Basic ${btoa(`${username}:${password}`)}`
);

export const getStoredAuth = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return null;
  }
};

export const setStoredAuth = (authHeader) => {
  try {
    localStorage.setItem(STORAGE_KEY, authHeader);
  } catch (error) {
    // ignore storage errors
  }
};

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // ignore storage errors
  }
};

export const getAuthHeader = () => {
  const stored = getStoredAuth();
  if (stored) return stored;

  const rawAuth = import.meta.env.VITE_API_BASIC_AUTH;
  const envUser = import.meta.env.VITE_API_USER;
  const envPassword = import.meta.env.VITE_API_PASSWORD;

  if (rawAuth) {
    if (rawAuth.includes(':')) {
      return `Basic ${btoa(rawAuth)}`;
    }
    return `Basic ${rawAuth}`;
  }

  if (envUser && envPassword) {
    return buildBasicAuth(envUser, envPassword);
  }

  return null;
};

export const login = async (username, password) => {
  const authHeader = buildBasicAuth(username, password);
  const response = await client.get('/users/me', {
    headers: { Authorization: authHeader }
  });
  setStoredAuth(authHeader);
  return response.data;
};

export const fetchCurrentUser = async () => {
  const authHeader = getAuthHeader();
  if (!authHeader) {
    throw new Error('Missing auth header');
  }
  const response = await client.get('/users/me', {
    headers: { Authorization: authHeader }
  });
  return response.data;
};

export const logout = () => {
  clearStoredAuth();
};
