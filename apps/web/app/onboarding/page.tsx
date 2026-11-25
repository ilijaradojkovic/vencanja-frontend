import { AuthShell, BrandRow } from '@/components/auth/AuthShell';
import { OnboardingWizard } from '@/components/auth/OnboardingWizard';
import { getTranslator } from '@/lib/i18n/server';

export const metadata = { title: 'Dobro došli · Uspomena' };

export default async function OnboardingPage() {
  const { t } = await getTranslator();

  return (
    <AuthShell wide>
      <BrandRow />
      <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
        <h1 style={{ fontSize: 32 }}>{t('onboarding.title')}</h1>
        <p className="muted small">{t('onboarding.intro')}</p>
      </div>
      <OnboardingWizard
        copy={{
          title: t('onboarding.title'),
          intro: t('onboarding.intro'),
          step: t('onboarding.step'),
          typeTitle: t('onboarding.typeTitle'),
          wedding: t('onboarding.wedding'),
          celebration: t('onboarding.celebration'),
          namesTitle: t('onboarding.namesTitle'),
          contactTitle: t('onboarding.contactTitle'),
          phoneHint: t('onboarding.phoneHint'),
          back: t('onboarding.back'),
          next: t('onboarding.next'),
          finish: t('onboarding.finish'),
          logout: t('onboarding.logout'),
          error: t('onboarding.error'),
          fields: {
            partner1: t('fields.partner1'),
            partner2: t('fields.partner2'),
            celebrant: t('fields.celebrant'),
            occasion: t('fields.occasion'),
            occasionPlaceholder: t('fields.occasionPlaceholder'),
            weddingDate: t('fields.weddingDate'),
            celebrationDate: t('fields.celebrationDate'),
            phone: t('fields.phone'),
            city: t('fields.city'),
            cityPlaceholder: t('fields.cityPlaceholder'),
          },
        }}
      />
    </AuthShell>
  );
}
