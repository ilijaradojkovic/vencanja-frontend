/**
 * Base API client for making HTTP requests to the backend.
 */

import axios from 'axios';
import { getApiBaseUrl, isMockEnabled } from './env.js';

/**
 * Create axios instance with base configuration
 */
export const axiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Add request interceptor to include auth token
 */
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

/**
 * VITE_USE_MOCK=true → zahtevi ne idu na mrežu nego u mock backend (src/mock).
 * Dinamički import → mock kod ne ulazi u bundle kad je mock isključen.
 */
if (isMockEnabled()) {
  axiosInstance.defaults.adapter = (config) => import('../../mock/adapter').then((m) => m.mockAdapter(config));
}

/**
 * Gets the authentication token from local storage.
 * @returns {string|null} The JWT token or null if not found
 */
export function getAuthToken() {
  try {
    return localStorage.getItem('authToken');
  } catch {
    return null;
  }
}

/**
 * Sets the authentication token in local storage.
 * @param {string} token - The JWT token to store
 */
export function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

export function setRefreshToken(token) {
  localStorage.setItem('refreshToken', token);
}

/**
 * Removes the authentication token from local storage.
 */
export function clearAuthToken() {
  localStorage.removeItem('authToken');
}

/**
 * Removes the refresh token from local storage.
 */
export function clearRefreshToken() {
  localStorage.removeItem('refreshToken');
}
