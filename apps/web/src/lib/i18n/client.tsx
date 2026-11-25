'use client';

import type { Language } from '@uspomena/shared';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';

import { createI18nInstance } from './create';

/**
 * Client translation provider for the organizer and guest screens. It receives the
 * locale/event type from the server page and creates one i18next instance per
 * locale/event type, so a client navigation never mixes celebration and wedding copy
 * and a language switch updates client text immediately.
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
  // A language switch refreshes the server components, which pass a new `locale`;
  // the instance is recreated so client text follows without a full reload.
  const i18n = useMemo(() => createI18nInstance(locale, eventType), [locale, eventType]);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
