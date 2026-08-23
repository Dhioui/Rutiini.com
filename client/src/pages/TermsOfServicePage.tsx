import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";

export function TermsOfServicePage() {
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
              <h1 className="text-3xl font-bold mb-2">{t('termsOfService')}</h1>
              <p className="text-muted-foreground">{t('termsEffectiveDate')}</p>
            </div>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsIntroTitle')}</h2>
              <p className="text-foreground">
                {t('termsIntro')}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsServiceTitle')}</h2>
              <p className="text-foreground">
                {t('termsService')}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsUserRolesTitle')}</h2>
              <p className="text-foreground mb-3">{t('termsUserRolesIntro')}</p>
              <ul className="list-disc pl-6 space-y-1 text-foreground">
                <li>{t('termsUserRoles1')}</li>
                <li>{t('termsUserRoles2')}</li>
                <li>{t('termsUserRoles3')}</li>
                <li>{t('termsUserRoles4')}</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsJurisdictionTitle')}</h2>
              <p className="text-foreground">
                {t('termsJurisdiction')}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsAccountTerminationTitle')}</h2>
              <p className="text-foreground">
                {t('termsAccountTermination')}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsDisclaimerTitle')}</h2>
              <p className="text-foreground">
                {t('termsDisclaimer')}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsChangesTitle')}</h2>
              <p className="text-foreground">
                {t('termsChanges')}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold">{t('termsContactTitle')}</h2>
              <p className="text-foreground">
                {t('termsContact')} <strong>dhiouiabdelrahman@gmail.com</strong>
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
