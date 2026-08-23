import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";

export function PrivacyPolicyPage() {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('back')}
          </Button>
        </Link>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('privacyPolicy')}</h1>
            <p className="text-muted-foreground">{t('privacyPolicyEffectiveDate')}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyIntroTitle')}</h2>
            <p className="text-foreground">
              {t('privacyPolicyIntro')}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyCollectTitle')}</h2>
            <ul className="list-disc pl-6 space-y-1 text-foreground">
              <li>{t('privacyPolicyCollect1')}</li>
              <li>{t('privacyPolicyCollect2')}</li>
              <li>{t('privacyPolicyCollect3')}</li>
              <li>{t('privacyPolicyCollect4')}</li>
              <li>{t('privacyPolicyCollect5')}</li>
              <li>{t('privacyPolicyCollect6')}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyUseTitle')}</h2>
            <ul className="list-disc pl-6 space-y-1 text-foreground">
              <li>{t('privacyPolicyUse1')}</li>
              <li>{t('privacyPolicyUse2')}</li>
              <li>{t('privacyPolicyUse3')}</li>
              <li>{t('privacyPolicyUse4')}</li>
              <li>{t('privacyPolicyUse5')}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicySecurityTitle')}</h2>
            <p className="text-foreground mb-3">{t('privacyPolicySecurityIntro')}</p>
            <ul className="list-disc pl-6 space-y-1 text-foreground">
              <li>{t('privacyPolicySecurity1')}</li>
              <li>{t('privacyPolicySecurity2')}</li>
              <li>{t('privacyPolicySecurity3')}</li>
              <li>{t('privacyPolicySecurity4')}</li>
              <li>{t('privacyPolicySecurity5')}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyRetentionTitle')}</h2>
            <ul className="list-disc pl-6 space-y-1 text-foreground">
              <li>{t('privacyPolicyRetention1')}</li>
              <li>{t('privacyPolicyRetention2')}</li>
              <li>{t('privacyPolicyRetention3')}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyIsolationTitle')}</h2>
            <p className="text-foreground">
              {t('privacyPolicyIsolation')}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyRightsTitle')}</h2>
            <p className="text-foreground mb-3">{t('privacyPolicyRightsIntro')}</p>
            <ul className="list-disc pl-6 space-y-1 text-foreground">
              <li>{t('privacyPolicyRights1')}</li>
              <li>{t('privacyPolicyRights2')}</li>
              <li>{t('privacyPolicyRights3')}</li>
              <li>{t('privacyPolicyRights4')}</li>
              <li>{t('privacyPolicyRights5')}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyChildrenTitle')}</h2>
            <p className="text-foreground">
              {t('privacyPolicyChildren')}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyThirdPartyTitle')}</h2>
            <ul className="list-disc pl-6 space-y-1 text-foreground">
              <li>{t('privacyPolicyThirdParty1')}</li>
              <li>{t('privacyPolicyThirdParty2')}</li>
              <li>{t('privacyPolicyThirdParty3')}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyChangesTitle')}</h2>
            <p className="text-foreground">
              {t('privacyPolicyChanges')}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t('privacyPolicyContactTitle')}</h2>
            <p className="text-foreground">
              {t('privacyPolicyContact')} <strong>dhiouiabdelrahman@gmail.com</strong>
            </p>
          </section>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
