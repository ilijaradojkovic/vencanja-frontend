import { cookies } from 'next/headers';

import { parseLanguage, type Language } from '@uspomena/shared';

export const LOCALE_COOKIE = 'lang';

/** Locale of the current request, from the `lang` cookie (D13, SYS-6). */
export const getLocale = async (): Promise<Language> => {
  const cookieStore = await cookies();
  return parseLanguage(cookieStore.get(LOCALE_COOKIE)?.value);
};
