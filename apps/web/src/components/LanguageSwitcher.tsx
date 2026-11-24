'use client';

import { useRouter } from 'next/navigation';
import type { Language } from '@uspomena/shared';

import { setLocaleCookie } from '@/lib/auth/actions';

const LANGUAGES: { code: Language; short: string; label: string }[] = [
  { code: 'sr', short: 'SR', label: 'Srpski' },
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ru', short: 'RU', label: 'Русский' },
];

/** UC-10: writes the `lang` cookie and re-renders the server components. */
export function LanguageSwitcher({
  current,
  dark = false,
  label,
}: {
  current: Language;
  dark?: boolean;
  label: string;
}) {
  const router = useRouter();
  return (
    <div className={`lang-switch ${dark ? 'lang-switch-dark' : ''}`} role="group" aria-label={label}>
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          lang={language.code}
          title={language.label}
          aria-label={language.label}
          aria-pressed={current === language.code}
          onClick={() => {
            setLocaleCookie(language.code);
            router.refresh();
          }}
        >
          {language.short}
        </button>
      ))}
    </div>
  );
}
