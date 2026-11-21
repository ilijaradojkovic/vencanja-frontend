import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { deleteAccount, fetchAccounts, resetAccountPassword, updateAccount } from '../services/admin.service';
import AccountModal from '../components/AccountModal';
import CredentialsModal from '../components/CredentialsModal';
import Icon from '../../../components/Icon';
import { ConfirmModal, PageLoading } from '../../../components/ui';
import { formatDate, formatDateTime } from '../../../utils/format';
import { formatPhone } from '../../../utils/phone';
import { eventNames, isCelebration } from '../../../utils/event';

const SHORT_DATE = { day: 'numeric', month: 'numeric', year: 'numeric' };

export default function AdminAccountsPage() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const { accounts, status, saving } = useAppSelector((s) => s.admin);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    dispatch(fetchAccounts());
  }, [dispatch]);

  const counts = useMemo(() => ({
    all: accounts.length,
    active: accounts.filter((a) => a.active).length,
    inactive: accounts.filter((a) => !a.active).length,
  }), [accounts]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filter === 'active' && !a.active) return false;
      if (filter === 'inactive' && a.active) return false;
      if (!term) return true;
      return [a.email, a.name, a.phone, a.wedding?.slug, a.wedding?.occasion].some((x) => String(x || '').toLowerCase().includes(term));
    });
  }, [accounts, q, filter]);

  const toggleActive = async (a) => {
    const res = await dispatch(updateAccount({ id: a.id, active: !a.active }));
    if (res.meta.requestStatus === 'fulfilled') toast.success(a.active ? t('toast.deactivated') : t('toast.activated'));
    setModal(null);
  };

  const resetPassword = async (a) => {
    const res = await dispatch(resetAccountPassword({ id: a.id }));
    if (res.meta.requestStatus === 'fulfilled') {
      setModal({ type: 'credentials', title: t('credentials.resetTitle'), email: a.email, password: res.payload.password });
    }
  };

  const remove = async (a) => {
    const res = await dispatch(deleteAccount(a.id));
    if (res.meta.requestStatus === 'fulfilled') {
      toast.success(t('toast.deleted'));
      setModal(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('eyebrow', { count: accounts.length })}</p>
          <h1>{t('title')}</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}><Icon name="plus" size={18} /> {t('newAccount')}</button>
      </div>

      <section className="card stack">
        <div className="row between">
          <label className="row grow" style={{ maxWidth: 360, position: 'relative' }}>
            <span className="sr-only">{t('search')}</span>
            <Icon name="search" size={18} style={{ position: 'absolute', left: 14, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 42 }} placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="chips" role="group" aria-label={t('filterAria')}>
            {['all', 'active', 'inactive'].map((k) => (
              <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {t(`filters.${k}`)} <span className="count">{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>

        {status === 'loading' && !accounts.length ? <PageLoading /> : visible.length === 0 ? (
          <div className="empty">
            <strong>{accounts.length ? t('emptyFilter') : t('empty')}</strong>
            {!accounts.length && <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>{t('addFirst')}</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.couple')}</th><th>{t('table.contact')}</th><th>{t('table.date')}</th><th>{t('table.usage')}</th>
                  <th>{t('table.status')}</th><th>{t('table.lastLogin')}</th><th style={{ textAlign: 'right' }}>{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="stack" style={{ '--gap': '0' }}>
                        <strong style={{ fontWeight: 500 }}>{a.wedding ? eventNames(a.wedding) : a.name}</strong>
                        {a.wedding && (
                          <span className="xs muted">
                            {isCelebration(a.wedding) ? a.wedding.occasion || t('type.celebration') : t('type.wedding')} · /{a.wedding.slug}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="small">
                      <div className="stack" style={{ '--gap': '0' }}>
                        <span>{a.email}</span>
                        <span className="xs muted">{a.phone ? formatPhone(a.phone) : '–'}</span>
                      </div>
                    </td>
                    <td className="small">{a.wedding?.date ? formatDate(a.wedding.date, SHORT_DATE) : '–'}</td>
                    <td className="small muted">{t('usage', { guests: a.stats.guests, photos: a.stats.photos })}</td>
                    <td><span className={`badge ${a.active ? 'badge-yes' : 'badge-no'}`}>{a.active ? t('status.active') : t('status.inactive')}</span></td>
                    <td className="small muted">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : t('neverLoggedIn')}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', '--gap': '6px', flexWrap: 'nowrap' }}>
                        <button className="icon-btn icon-btn-sm" onClick={() => setModal({ type: 'edit', account: a })} aria-label={t('aria.edit', { email: a.email })} title={t('actions.edit')}><Icon name="edit" size={18} /></button>
                        <button className="icon-btn icon-btn-sm" onClick={() => setModal({ type: 'reset', account: a })} aria-label={t('aria.reset', { email: a.email })} title={t('actions.resetPassword')}><Icon name="lock" size={18} /></button>
                        <button className="icon-btn icon-btn-sm" onClick={() => (a.active ? setModal({ type: 'deactivate', account: a }) : toggleActive(a))} aria-label={t(a.active ? 'aria.deactivate' : 'aria.activate', { email: a.email })} title={t(a.active ? 'actions.deactivate' : 'actions.activate')}>
                          <Icon name={a.active ? 'eyeOff' : 'eye'} size={18} />
                        </button>
                        <button className="icon-btn icon-btn-sm" onClick={() => setModal({ type: 'delete', account: a })} aria-label={t('aria.delete', { email: a.email })} title={t('common:actions.delete')}><Icon name="trash" size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.type === 'new' && (
        <AccountModal
          onClose={() => setModal(null)}
          onCreated={({ account, password }) => setModal({ type: 'credentials', title: t('credentials.createdTitle'), email: account.email, password })}
        />
      )}
      {modal?.type === 'edit' && <AccountModal account={modal.account} onClose={() => setModal(null)} />}
      {modal?.type === 'credentials' && <CredentialsModal title={modal.title} email={modal.email} password={modal.password} onClose={() => setModal(null)} />}
      {modal?.type === 'reset' && (
        <ConfirmModal
          title={t('confirm.resetTitle')}
          text={t('confirm.resetText', { email: modal.account.email })}
          confirmLabel={t('actions.resetPassword')}
          busy={saving}
          onConfirm={() => resetPassword(modal.account)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'deactivate' && (
        <ConfirmModal
          title={t('confirm.deactivateTitle')}
          text={t('confirm.deactivateText', { email: modal.account.email })}
          confirmLabel={t('actions.deactivate')}
          busy={saving}
          onConfirm={() => toggleActive(modal.account)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          title={t('confirm.deleteTitle')}
          text={t('confirm.deleteText', { email: modal.account.email, guests: modal.account.stats.guests, photos: modal.account.stats.photos })}
          busy={saving}
          onConfirm={() => remove(modal.account)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
