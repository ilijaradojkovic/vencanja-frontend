import { render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';

import { galleryStatusText } from '../src/features/invite/gallery-status';
import { createTranslator } from '../src/lib/i18n/server';
import { LocaleProvider } from '../src/lib/i18n/client';

function Label() {
  const { t } = useTranslation('invite');
  return <p>{t('envelope.open')}</p>;
}

describe('LocaleProvider (UC-10)', () => {
  it('switches client text when the server passes a new locale, without a reload', () => {
    const { rerender } = render(
      <LocaleProvider locale="sr">
        <Label />
      </LocaleProvider>,
    );
    expect(screen.getByText('Otvori pozivnicu')).toBeInTheDocument();
    rerender(
      <LocaleProvider locale="en">
        <Label />
      </LocaleProvider>,
    );
    expect(screen.getByText('Open the invitation')).toBeInTheDocument();
    rerender(
      <LocaleProvider locale="ru">
        <Label />
      </LocaleProvider>,
    );
    expect(screen.queryByText('Open the invitation')).not.toBeInTheDocument();
  });
});

describe('galleryStatusText', () => {
  const closed = { open: false, mode: 'after_wedding' as const, opensAt: '2027-06-13' };

  it('does not double the sentence-final dot after a Serbian date', () => {
    const { t } = createTranslator('sr');
    const text = galleryStatusText(t, closed, 'sr');
    expect(text).toBe('Galerija se otvara gostima 13. jun 2027.');
    expect(text).not.toMatch(/\.\.$/);
  });

  it('keeps the Russian year abbreviation and the English sentence intact', () => {
    const ru = galleryStatusText(createTranslator('ru').t, closed, 'ru');
    expect(ru).toMatch(/2027 г\.$/);
    expect(ru).not.toMatch(/\.\.$/);
    const en = galleryStatusText(createTranslator('en').t, closed, 'en');
    expect(en).toMatch(/13 June 2027\.?$/);
    expect(en).not.toMatch(/\.\.$/);
  });

  it('describes the open and manual states', () => {
    const { t } = createTranslator('sr');
    expect(galleryStatusText(t, { ...closed, open: true }, 'sr')).toBe('Galerija je otvorena.');
    expect(galleryStatusText(t, { open: false, mode: 'manual', opensAt: null }, 'sr')).toBe(
      'Galerija se otvara kada je mladenci otvore.',
    );
  });
});
