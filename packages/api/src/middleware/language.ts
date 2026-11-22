import { parseLanguage } from '@uspomena/shared';
import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../http.ts';

/** Resolves the request language from `Accept-Language` (SYS-6). */
export const language = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  c.set('language', parseLanguage(c.req.header('accept-language')));
  await next();
};
