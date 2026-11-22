import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { isAuthConfigured, supabaseKey, supabaseUrl } from './config';

/** Server-side Supabase client bound to the request cookies (session refresh, callbacks). */
export const getServerAuth = async () => {
  if (!isAuthConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
      },
    },
  });
};
