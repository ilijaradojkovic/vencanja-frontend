'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Modal } from '@/components/Modal';
import { FormError } from '@/components/auth/AuthShell';

import {
  downloadAllOriginals,
  downloadMode,
  fetchOriginalsPage,
  LARGE_DOWNLOAD_BYTES,
  type DownloadScope,
  type Progress,
} from './download';

const formatSize = (bytes: number): string =>
  bytes >= 1_000_000_000
    ? `${(bytes / 1_000_000_000).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;

/**
 * UC-85 "Download all": choose approved or all, see the size (with a warning for
 * very large downloads and the batch fallback note), then follow "N / M" progress.
 */
export function DownloadAllModal({
  eventId,
  archiveName,
  onClose,
}: {
  eventId: string;
  archiveName: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('photos');
  const [scope, setScope] = useState<DownloadScope>('approved');
  const [summary, setSummary] = useState<{ scope: DownloadScope; total: number; totalBytes: number } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const mode = downloadMode();

  useEffect(() => {
    let cancelled = false;
    fetchOriginalsPage(eventId, scope, null, 1)
      .then((page) => {
        if (!cancelled) setSummary({ scope, total: page.total, totalBytes: page.totalBytes });
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, scope]);

  useEffect(() => () => abort.current?.abort(), []);

  const current = summary?.scope === scope ? summary : null;
  const running = progress !== null && result === null && error === null;

  const start = async () => {
    if (!current) return;
    setError(null);
    setResult(null);
    abort.current = new AbortController();
    try {
      const outcome = await downloadAllOriginals(
        eventId,
        scope,
        archiveName,
        current.total,
        setProgress,
        abort.current.signal,
      );
      setResult(
        outcome.mode === 'batches' ? t('download.doneBatches', { count: outcome.archives }) : t('download.done'),
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setProgress(null);
        return;
      }
      setError(t('download.failed', { message: caught instanceof Error ? caught.message : String(caught) }));
    }
  };

  return (
    <Modal
      title={t('download.title')}
      closeLabel={t('common:actions.close')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-soft" onClick={onClose}>
            {running ? t('common:actions.cancel') : t('common:actions.close')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!current || current.total === 0 || running}
            onClick={() => void start()}
          >
            {t('download.start')}
          </button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '14px' } as CSSProperties}>
        <p className="small muted">{t('download.text')}</p>
        <div className="segmented" role="group" aria-label={t('download.scopeAria')}>
          {(['approved', 'all'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={scope === key}
              disabled={running}
              onClick={() => {
                setScope(key);
                setProgress(null);
                setResult(null);
              }}
            >
              {key === 'approved' ? t('download.approved') : t('download.everything')}
            </button>
          ))}
        </div>
        {current ? (
          current.total === 0 ? (
            <p className="small">{t('download.empty')}</p>
          ) : (
            <p className="small" data-testid="download-summary">
              {t('download.summary', {
                photos: t('common:count.photos', { count: current.total }),
                size: formatSize(current.totalBytes),
              })}
            </p>
          )
        ) : null}
        {current && current.totalBytes > LARGE_DOWNLOAD_BYTES ? (
          <p className="small" role="alert">
            {t('download.large', { size: formatSize(current.totalBytes) })}
          </p>
        ) : null}
        {mode === 'batches' ? <p className="xs muted">{t('download.batches')}</p> : null}
        {progress ? (
          <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
            <progress max={Math.max(progress.total, 1)} value={progress.done} style={{ width: '100%' }} />
            <span className="small" aria-live="polite" data-testid="download-progress">
              {t('download.progress', { done: progress.done, total: progress.total })}
            </span>
          </div>
        ) : null}
        {result ? (
          <p className="small" role="status">
            {result}
          </p>
        ) : null}
        {error ? <FormError>{error}</FormError> : null}
      </div>
    </Modal>
  );
}
