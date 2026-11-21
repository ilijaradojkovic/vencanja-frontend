import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createRequest, fetchRequests } from '../services/requests.service';
import { toast } from 'react-toastify';
import Icon from '../../../components/Icon';
import ContactPhoneNote from '../../../components/ContactPhoneNote';
import { formatPhone } from '../../../utils/phone';
import { PageLoading, Spinner } from '../../../components/ui';
import { formatDate, REQUEST_STATUS, REQUEST_TYPES } from '../../../utils/format';

const STEPS = ['received', 'in_progress', 'review', 'done'];
const NEW_TYPES = ['invitation', 'big_album'];
const EMPTY = { type: 'invitation', style: 'romantic', budget: 'from100to200', description: '' };
const STYLES = ['romantic', 'modern', 'boho', 'editorial', 'illustration'];
const BUDGETS = ['upTo50', 'from50to100', 'from100to200', 'over200'];

export default function DesignRequests() {
  const { t } = useTranslation('requests');
  const dispatch = useAppDispatch();
  const { items, status, saving } = useAppSelector((s) => s.requests);
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  useEffect(() => {
    if (status === 'idle') dispatch(fetchRequests());
  }, [dispatch, status]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.description.trim()) return setError(t('describeError'));
    setError('');
    const res = await dispatch(createRequest({ ...f, pages: null, includePrint: false }));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t('invite:custom.sentToast'));
      setF(EMPTY);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t('common:nav.customDesign')}</h1>
        </div>
      </div>

      <div className="two-col">
        <form className="main card stack" onSubmit={submit} aria-labelledby="new-h">
          <div className="stack" style={{ '--gap': '6px' }}>
            <h2 id="new-h">{t('newTitle')}</h2>
            <p className="muted small">{t('newText')}</p>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="segmented" role="group" aria-label={t('bigAlbum:request.what')} style={{ alignSelf: 'flex-start' }}>
            {NEW_TYPES.map((k) => [k, REQUEST_TYPES[k]]).map(([k, v]) => (
              <button type="button" key={k} aria-pressed={f.type === k} onClick={() => setF({ ...f, type: k })}>{v}</button>
            ))}
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <label className="field grow"><span>{t('invite:custom.style')}</span>
              <select className="select" value={f.style} onChange={set('style')}>
                {STYLES.map((s) => <option key={s} value={s}>{t(`invite:custom.styles.${s}`)}</option>)}
              </select></label>
            <label className="field" style={{ width: 170 }}><span>{t('invite:custom.budget')}</span>
              <select className="select" value={f.budget} onChange={set('budget')}>
                {BUDGETS.map((b) => <option key={b} value={b}>{t(`invite:custom.budgets.${b}`)}</option>)}
              </select></label>
          </div>
          <label className="field"><span>{t('important')}</span>
            <textarea className="textarea" rows={5} value={f.description} onChange={set('description')}
              placeholder={t('importantPlaceholder')} /></label>
          <ContactPhoneNote />
          <button className="btn btn-primary btn-lg" style={{ alignSelf: 'flex-start' }} disabled={saving}>{saving ? <Spinner light /> : t('invite:custom.submit')}</button>
        </form>

        <section className="side stack" aria-labelledby="list-h">
          <h2 id="list-h">{t('listTitle')}</h2>
          {status === 'loading' ? <PageLoading /> : items.length === 0 ? (
            <div className="empty"><span className="muted">{t('listEmpty')}</span></div>
          ) : items.map((r) => {
            const step = STEPS.indexOf(r.status);
            return (
              <article key={r.id} className="card stack" style={{ '--gap': '12px' }}>
                <div className="row between">
                  <strong style={{ fontWeight: 500 }}>{REQUEST_TYPES[r.type]} · {r.style}</strong>
                  <span className={`badge ${r.status === 'done' ? 'badge-yes' : 'badge-pending'}`}>{REQUEST_STATUS[r.status]}</span>
                </div>
                <p className="small" style={{ color: 'var(--ink-2)' }}>{r.description}</p>
                <ol className="row" style={{ listStyle: 'none', padding: 0, margin: 0, '--gap': '6px', flexWrap: 'nowrap' }} aria-label={t('progress')}>
                  {STEPS.map((s, i) => (
                    <li key={s} className="grow stack" style={{ '--gap': '4px' }}>
                      <span style={{ height: 4, borderRadius: 4, background: i <= step ? 'var(--green)' : '#e6dfd3' }} />
                      <span className="xs" style={{ color: i <= step ? 'var(--ink)' : 'var(--muted)' }}>{REQUEST_STATUS[s]}</span>
                    </li>
                  ))}
                </ol>
                {r.designerNote && (
                  <div className="row" style={{ '--gap': '8px', alignItems: 'flex-start', padding: 12, borderRadius: 10, background: 'var(--bg)' }}>
                    <Icon name="sparkle" size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                    <span className="small"><strong style={{ fontWeight: 500 }}>{t('designer')}</strong> {r.designerNote}</span>
                  </div>
                )}
                <span className="xs muted">{t('meta', { date: formatDate(r.createdAt), budget: r.budget })}{r.pages ? ` · ${t('pages', { count: r.pages })}` : ''}{r.contactPhone ? ` · ${t('contact', { phone: formatPhone(r.contactPhone) })}` : ''}</span>
              </article>
            );
          })}
        </section>
      </div>
    </>
  );
}
