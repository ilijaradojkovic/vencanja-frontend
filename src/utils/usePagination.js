import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Klijentsko straničenje za listu koja je već cela učitana.
 * - `storageKey`: broj stavki po strani se pamti u ovom browseru (pogodnost)
 * - `resetKey`: kad se promeni (pretraga, filter), vraća na stranu 1
 * - ako lista postane kraća (brisanje), strana se sama spušta na poslednju postojeću
 * Vraća i `topRef` – postavi ga na vrh liste da se pri promeni strane skroluje do nje.
 */
export function usePagination(items, { storageKey, defaultSize = 10, resetKey } = {}) {
  const [pageSize, setPageSizeState] = useState(() => {
    try {
      return Number(localStorage.getItem(`page-size:${storageKey}`)) || defaultSize;
    } catch {
      return defaultSize;
    }
  });
  const [page, setPageState] = useState(1);
  const topRef = useRef(null);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPageState(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pages) setPageState(pages);
  }, [page, pages]);

  const scrollTop = () => {
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setPage = (p) => {
    setPageState(Math.min(Math.max(1, p), pages));
    scrollTop();
  };

  const setPageSize = (size) => {
    setPageSizeState(size);
    setPageState(1);
    try {
      localStorage.setItem(`page-size:${storageKey}`, String(size));
    } catch {
      /* ignore */
    }
  };

  const current = Math.min(page, pages);
  const pageItems = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize]);

  return { page: current, pageSize, pages, pageItems, setPage, setPageSize, topRef, total: items.length };
}
