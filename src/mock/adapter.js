/**
 * Axios adapter za mock režim (VITE_USE_MOCK=true).
 * Zahtev ne ide na mrežu nego u mockRequest – isti URL, metod i telo kao pravi BE,
 * a odgovor/greška imaju isti oblik kao od axios-a (response.data, error.response.status).
 */
import { AxiosError } from 'axios';
import { mockRequest } from './server';

const tokenFrom = (headers) => {
  const auth = headers?.get?.('Authorization') ?? headers?.Authorization;
  return auth ? String(auth).replace(/^Bearer\s+/i, '') : null;
};

export async function mockAdapter(config) {
  // axios je JSON telo već pretvorio u string; FormData ostaje FormData
  let data = config.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      /* ostaje string */
    }
  }

  const onUploadProgress = config.onUploadProgress
    ? (pct) => config.onUploadProgress({ loaded: pct, total: 100, progress: pct / 100 })
    : undefined;

  try {
    const result = await mockRequest({
      method: config.method.toUpperCase(),
      url: config.url,
      data,
      params: config.params,
      token: tokenFrom(config.headers),
      onUploadProgress,
    });
    return { data: result, status: 200, statusText: 'OK', headers: {}, config, request: null };
  } catch (err) {
    const status = err.status || 500;
    const response = { data: err.data ?? { message: err.message }, status, statusText: '', headers: {}, config, request: null };
    throw new AxiosError(err.message, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, null, response);
  }
}
