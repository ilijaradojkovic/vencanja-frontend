import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignOutButton } from '@/components/auth/SignOutButton';
import { AccountsPage } from '@/features/admin/AccountsPage';
import { getProfileById } from '@uspomena/api/server-only';
import { getServerAuth } from '@/lib/auth/server';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Nalozi · Uspomena' };

/** Superadmin account list (UC-71 – UC-76); the API enforces the role. */
export default async function AdminPage() {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fadmin');

  const profile = await getProfileById(data.user.id);
  if (!profile || profile.role !== 'superadmin') redirect('/app');

  const { t } = await getTranslator();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="card" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, padding: '14px 20px' }}>
        <div className="row between" style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Link className="brand" href="/admin" style={{ color: 'var(--ink)' }}>
            Uspomena
          </Link>
          <div className="row" style={{ '--gap': '12px' } as React.CSSProperties}>
            <span className="small muted">{t('admin.title')}</span>
            <SignOutButton label={t('dashboard.logout')} />
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: 24 }}>
        <AccountsPage
          appUrl={process.env.APP_URL ?? 'http://localhost:3000'}
          copy={{
            eyebrow: t('admin.eyebrow'),
            title: t('admin.title'),
            newAccount: t('admin.newAccount'),
            search: t('admin.search'),
            searchPlaceholder: t('admin.searchPlaceholder'),
            filterAria: t('admin.filterAria'),
            filters: {
              all: t('admin.filters.all'),
              active: t('admin.filters.active'),
              inactive: t('admin.filters.inactive'),
            },
            empty: t('admin.empty'),
            emptyFilter: t('admin.emptyFilter'),
            addFirst: t('admin.addFirst'),
            table: {
              couple: t('admin.table.couple'),
              contact: t('admin.table.contact'),
              date: t('admin.table.date'),
              usage: t('admin.table.usage'),
              status: t('admin.table.status'),
              lastLogin: t('admin.table.lastLogin'),
              actions: t('admin.table.actions'),
            },
            type: { wedding: t('admin.type.wedding'), celebration: t('admin.type.celebration') },
            usage: t('admin.usage'),
            status: { active: t('admin.status.active'), inactive: t('admin.status.inactive') },
            neverLoggedIn: t('admin.neverLoggedIn'),
            actions: {
              edit: t('admin.actions.edit'),
              resetPassword: t('admin.actions.resetPassword'),
              deactivate: t('admin.actions.deactivate'),
              activate: t('admin.actions.activate'),
              delete: t('admin.actions.delete'),
              copy: t('admin.actions.copy'),
              copied: t('admin.actions.copied'),
            },
            fields: {
              type: t('admin.fields.type'),
              partner1: t('admin.fields.partner1'),
              partner2: t('admin.fields.partner2'),
              celebrant: t('admin.fields.celebrant'),
              occasion: t('admin.fields.occasion'),
              occasionPlaceholder: t('admin.fields.occasionPlaceholder'),
              date: t('admin.fields.date'),
              celebrationDate: t('admin.fields.celebrationDate'),
              email: t('admin.fields.email'),
              phone: t('admin.fields.phone'),
              password: t('admin.fields.password'),
            },
            modal: {
              newTitle: t('admin.modal.newTitle'),
              editTitle: t('admin.modal.editTitle'),
              create: t('admin.modal.create'),
              save: t('admin.modal.save'),
              cancel: t('admin.modal.cancel'),
              emailHint: t('admin.modal.emailHint'),
              emailHintCelebration: t('admin.modal.emailHintCelebration'),
              passwordPlaceholder: t('admin.modal.passwordPlaceholder'),
              passwordHint: t('admin.modal.passwordHint'),
              phoneWillSave: t('admin.modal.phoneWillSave'),
            },
            loading: t('admin.loading'),
            credentials: {
              createdTitle: t('admin.credentials.createdTitle'),
              resetTitle: t('admin.credentials.resetTitle'),
              hint: t('admin.credentials.hint'),
              copy: t('admin.credentials.copy'),
              message: t('admin.credentials.message'),
            },
            confirm: {
              resetTitle: t('admin.confirm.resetTitle'),
              resetText: t('admin.confirm.resetText'),
              deactivateTitle: t('admin.confirm.deactivateTitle'),
              deactivateText: t('admin.confirm.deactivateText'),
              deleteTitle: t('admin.confirm.deleteTitle'),
              deleteText: t('admin.confirm.deleteText'),
              reset: t('admin.confirm.reset'),
              deactivate: t('admin.confirm.deactivate'),
              delete: t('admin.confirm.delete'),
            },
            messages: {
              created: t('admin.messages.created'),
              updated: t('admin.messages.updated'),
              deactivated: t('admin.messages.deactivated'),
              activated: t('admin.messages.activated'),
              deleted: t('admin.messages.deleted'),
              password: t('admin.messages.password'),
            },
            common: { close: t('common.close'), cancel: t('common.cancel') },
          }}
        />
      </main>
    </div>
  );
}
