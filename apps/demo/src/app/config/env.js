export const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!baseUrl) {
    console.error('VITE_API_BASE_URL is not defined in environment variables');
    return 'http://localhost:8001/api/v1';
  }

  return baseUrl;
};

export const isProduction = () => {
  return import.meta.env.MODE === 'production';
};

export const isDevelopment = () => {
  return import.meta.env.MODE === 'development';
};

export const isMockEnabled = () => {
  return import.meta.env.VITE_USE_MOCK === 'true';
};

export const getRouterMode = () => {
  return import.meta.env.VITE_ROUTER === 'hash' ? 'hash' : 'browser';
};

export default {
  apiBaseUrl: getApiBaseUrl(),
  isProduction: isProduction(),
  isDevelopment: isDevelopment(),
  useMock: isMockEnabled(),
  routerMode: getRouterMode(),
};
