import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Settings, Shield, FileText, Sparkles, ExternalLink, Lock, Database, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';

interface VersionInfo {
  version: string;
  build: string;
  buildDate: string;
  environment: string;
}

const changelog = [
  {
    version: '1.4.0',
    date: '2024-12-04',
    changes: {
      en: [
        'Added quick entries for staff (one-click recording)',
        'Improved menu system with Aromi integration',
        'Added 6-language support (fi, en, sv, ar, ru, so)',
        'Enhanced security with strong password policy',
        'Added health check endpoint for monitoring',
      ],
      fi: [
        'Lisätty pikamerkinnät henkilökunnalle (yhden klikkauksen kirjaus)',
        'Parannettu ruokalistajärjestelmä Aromi-integraatiolla',
        'Lisätty 6-kielinen tuki (fi, en, sv, ar, ru, so)',
        'Parannettu tietoturva vahvalla salasanakäytännöllä',
        'Lisätty health check -endpoint valvontaa varten',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2024-11-28',
    changes: {
      en: [
        'Added forms system for consent and surveys',
        'Implemented trip management with guardian responses',
        'Added absence reporting for guardians',
      ],
      fi: [
        'Lisätty lomakejärjestelmä suostumuksille ja kyselyille',
        'Toteutettu retkien hallinta huoltajien vastauksilla',
        'Lisätty poissaoloilmoitukset huoltajille',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2024-11-15',
    changes: {
      en: [
        'Added messaging system between staff and guardians',
        'Implemented notification system',
        'Added document management',
      ],
      fi: [
        'Lisätty viestintäjärjestelmä henkilökunnan ja huoltajien välille',
        'Toteutettu ilmoitusjärjestelmä',
        'Lisätty dokumenttien hallinta',
      ],
    },
  },
];

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language.split('-')[0];

  const { data: versionInfo } = useQuery<VersionInfo>({
    queryKey: ['/api/version'],
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-settings-title">
          <Settings className="h-8 w-8 text-primary" />
          {t('settings')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('securityInfoDesc')}</p>
      </div>

      {/* Version Info */}
      <Card className="border-0 shadow-md" data-testid="card-version-info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('version')}
          </CardTitle>
          <CardDescription>Rutiini - Daycare Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">{t('version')}</p>
              <p className="text-2xl font-bold text-primary">{versionInfo?.version || '1.4.0'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Build</p>
              <p className="text-2xl font-bold">{versionInfo?.build || '4'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="text-lg font-medium">{versionInfo?.buildDate || '2024-12-04'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Environment</p>
              <Badge variant={versionInfo?.environment === 'production' ? 'default' : 'secondary'}>
                {versionInfo?.environment || 'development'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & GDPR Info */}
      <Card className="border-0 shadow-md" data-testid="card-security-info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            {t('securityInfo')}
          </CardTitle>
          <CardDescription>{t('securityInfoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2 bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t('gdprCompliance')}</h3>
                <p className="text-sm text-muted-foreground">{t('gdprComplianceText')}</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2 bg-blue-500/10">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t('dataProtection')}</h3>
                <p className="text-sm text-muted-foreground">{t('dataProtectionText')}</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2 bg-purple-500/10">
                <Lock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">{t('securityMeasures')}</h3>
                <p className="text-sm text-muted-foreground">{t('securityMeasuresText')}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-4">
            <Link href="/privacy-policy">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                {t('privacyPolicy')}
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
            <Link href="/terms-of-service">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                {t('termsOfService')}
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Changelog */}
      <Card className="border-0 shadow-md" data-testid="card-changelog">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('changelog')}
          </CardTitle>
          <CardDescription>{t('changelogDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {changelog.map((release, index) => (
            <div key={release.version} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={index === 0 ? 'default' : 'secondary'}>v{release.version}</Badge>
                <span className="text-sm text-muted-foreground">{release.date}</span>
                {index === 0 && <Badge variant="outline" className="text-green-500 border-green-500">Latest</Badge>}
              </div>
              <ul className="space-y-1 ml-4">
                {(release.changes[currentLang as keyof typeof release.changes] || release.changes.en).map((change, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    {change}
                  </li>
                ))}
              </ul>
              {index < changelog.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
