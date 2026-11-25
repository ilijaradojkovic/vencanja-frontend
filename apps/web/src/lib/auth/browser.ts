'use client';

import { createBrowserClient } from '@supabase/ssr';

import { isAuthConfigured, supabaseKey, supabaseUrl } from './config';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client, used only for auth (SPEC §3.3). */
export const getBrowserAuth = () => {
  if (!isAuthConfigured()) return null;
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
};

/** Access token of the current session, or null when signed out/unconfigured. */
export const getAccessToken = async (): Promise<string | null> => {
  const auth = getBrowserAuth();
  if (!auth) return null;
  try {
    const { data } = await auth.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};
