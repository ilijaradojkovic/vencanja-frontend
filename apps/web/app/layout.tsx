import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getLocale } from '@/lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Uspomena · pozivnice i album venčanja',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
