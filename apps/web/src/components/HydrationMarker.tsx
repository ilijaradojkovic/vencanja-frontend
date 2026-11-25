'use client';

import { useEffect } from 'react';

/**
 * Marks the document once React has hydrated the page. Client components render
 * on the server first, so this lets E2E tests (and diagnostics) wait for
 * interactive behaviour instead of racing hydration. It renders nothing.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.body.dataset.hydrated = 'true';
  }, []);
  return null;
}
