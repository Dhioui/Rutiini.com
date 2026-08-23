import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  
  return (
    <footer className="border-t bg-background py-6" data-testid="footer">
      <div className="flex flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <div className="text-center text-xs space-y-1">
          <p className="font-semibold">{t('footerCompanyName')}</p>
          <p>{t('footerCompanyId')}</p>
          <p>{t('footerCompanyAddress')}</p>
          <p>{t('footerCompanyPhone')}</p>
        </div>
        
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/privacy-policy">
            <span className="text-xs hover:underline cursor-pointer" data-testid="link-privacy-policy">
              {t('footerPrivacyPolicy')}
            </span>
          </Link>
          <span>•</span>
          <Link href="/terms-of-service">
            <span className="text-xs hover:underline cursor-pointer" data-testid="link-terms">
              {t('footerTermsOfService')}
            </span>
          </Link>
          <span>•</span>
          <a href="mailto:dhiouiabdelrahman@gmail.com" className="text-xs hover:underline" data-testid="link-contact">
            {t('footerContactUs')}
          </a>
        </div>
        <p className="text-xs">{t('footerCopyright')}</p>
      </div>
    </footer>
  );
}
