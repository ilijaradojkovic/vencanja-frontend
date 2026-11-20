import axios from 'axios';
import { getApiBaseUrl, isMockEnabled } from './env.js';

export const axiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

if (isMockEnabled()) {
  axiosInstance.defaults.adapter = (config) => import('../../mock/adapter').then((m) => m.mockAdapter(config));
}

export function getAuthToken() {
  try {
    return localStorage.getItem('authToken');
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

export function setRefreshToken(token) {
  localStorage.setItem('refreshToken', token);
}

export function clearAuthToken() {
  localStorage.removeItem('authToken');
}

export function clearRefreshToken() {
  localStorage.removeItem('refreshToken');
}
