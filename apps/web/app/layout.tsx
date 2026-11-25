import '@fontsource/caveat/400.css';
import '@fontsource/caveat/600.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '../styles/theme.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { HydrationMarker } from '@/components/HydrationMarker';
import { getLocale } from '@/lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Uspomena · pozivnice i album venčanja',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <HydrationMarker />
        {children}
      </body>
    </html>
  );
}
