import { translateMessage, type Language, type MessageKey, type MessageParams } from '@uspomena/shared';
import type { Context } from 'hono';

import type { ProfileRow } from './services/profiles.ts';

/** Per-request values shared by every handler in the app (SPEC §3.3, §8.6). */
export type AppVariables = {
  requestId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  startedAt: number;
  language: Language;
  /** Set by the onboarding guard for routes under /weddings, /guests and /photos. */
  profile?: ProfileRow;
};

export type AppEnv = { Variables: AppVariables };

export type ApiErrorBody = {
  message: string;
  code: MessageKey;
  requestId: string;
  traceId: string;
};

export const translate = (c: Context<AppEnv>, code: MessageKey, params: MessageParams = {}): string =>
  translateMessage(code, params, c.get('language'));

/**
 * The single error envelope of the API: `{ message, code, requestId, traceId }`
 * (SYS-1, D17). `code` is a `packages/shared` message key and `message` is its
 * translation in the request's `Accept-Language`.
 */
export const errorBody = (c: Context<AppEnv>, code: MessageKey, params: MessageParams = {}): ApiErrorBody => ({
  message: translate(c, code, params),
  code,
  requestId: c.get('requestId'),
  traceId: c.get('traceId'),
});
