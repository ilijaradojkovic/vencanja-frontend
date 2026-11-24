'use client';

import type { Language } from '@uspomena/shared';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { createI18nInstance } from './create';

/**
 * Client translation provider for the organizer and guest screens. It receives the
 * locale/event type from the server page and creates one i18next instance per page
 * load, so a client navigation never mixes celebration and wedding copy.
 */
export function LocaleProvider({
  locale,
  eventType = 'wedding',
  children,
}: {
  locale: Language;
  eventType?: 'wedding' | 'celebration';
  children: ReactNode;
}) {
  const [i18n] = useState(() => createI18nInstance(locale, eventType));
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
