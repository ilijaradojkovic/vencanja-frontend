/**
 * Environment configuration module.
 * Loads configuration from environment variables set in .env files.
 *
 * .env.development → VITE_API_BASE_URL=http://localhost:8001/api/v1
 * .env.production  → VITE_API_BASE_URL=/api
 */

/**
 * Get the API base URL from environment variables.
 * @returns {string} The backend API base URL
 */
export const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!baseUrl) {
    console.error('VITE_API_BASE_URL is not defined in environment variables');
    return 'http://localhost:8001/api/v1'; // Fallback for development
  }

  return baseUrl;
};

/**
 * Check if running in production mode.
 * @returns {boolean} True if in production mode
 */
export const isProduction = () => {
  return import.meta.env.MODE === 'production';
};

/**
 * Check if running in development mode.
 * @returns {boolean} True if in development mode
 */
export const isDevelopment = () => {
  return import.meta.env.MODE === 'development';
};

/**
 * Mock backend (src/mock) umesto pravog servera – podaci se čuvaju u localStorage.
 * @returns {boolean} True ako je VITE_USE_MOCK=true
 */
export const isMockEnabled = () => {
  return import.meta.env.VITE_USE_MOCK === 'true';
};

/**
 * hash    = linkovi oblika /#/i/token (statički hosting bez server rewrite pravila)
 * browser = čisti linkovi /i/token (potreban fallback na index.html na serveru)
 * @returns {'hash'|'browser'}
 */
export const getRouterMode = () => {
  return import.meta.env.VITE_ROUTER === 'hash' ? 'hash' : 'browser';
};

// Export as default for convenience
export default {
  apiBaseUrl: getApiBaseUrl(),
  isProduction: isProduction(),
  isDevelopment: isDevelopment(),
  useMock: isMockEnabled(),
  routerMode: getRouterMode(),
};
