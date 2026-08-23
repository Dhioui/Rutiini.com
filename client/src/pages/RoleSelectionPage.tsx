import { Link, useRoute, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Users, UserCircle, ArrowLeft } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Footer } from "@/components/Footer";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function RoleSelectionPage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/select-role/:daycareCode");
  const [, setLocation] = useLocation();
  const daycareCode = params?.daycareCode || "";
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const validateDaycareCode = async () => {
      if (!daycareCode) {
        setLocation('/');
        return;
      }

      try {
        const response = await fetch(`/api/daycares/${daycareCode.toLowerCase().trim()}`);
        
        if (response.ok) {
          setIsValid(true);
        } else {
          toast({
            variant: "destructive",
            title: t('error'),
            description: t('invalidDaycareCode')
          });
          setLocation('/');
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: t('error'),
          description: t('connectionError')
        });
        setLocation('/');
      } finally {
        setIsValidating(false);
      }
    };

    validateDaycareCode();
  }, [daycareCode, setLocation, t, toast]);

  if (isValidating || !isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-blue-900">{t('validating')}...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="absolute top-4 left-4">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('back')}
        </Button>
      </div>
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-900 mb-2" data-testid="text-app-name">
            {t('appName')}
          </h1>
          <p className="text-lg text-blue-700" data-testid="text-app-tagline">
            {t('appTagline')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-md hover-elevate transition-all cursor-pointer" data-testid="card-role-daycareleader">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl">{t('admin')}</CardTitle>
              <CardDescription>
                {t('loginAsAdmin')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/login/daycareleader/${daycareCode}`}>
                <Button className="w-full" size="lg" data-testid="button-login-daycareleader">
                  {t('login')}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover-elevate transition-all cursor-pointer" data-testid="card-role-staff">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shadow-sm">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">{t('staff')}</CardTitle>
              <CardDescription>
                {t('loginAsStaff')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/login/staff/${daycareCode}`}>
                <Button className="w-full" size="lg" data-testid="button-login-staff">
                  {t('login')}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover-elevate transition-all cursor-pointer" data-testid="card-role-guardian">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center shadow-sm">
                <UserCircle className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl">{t('guardian')}</CardTitle>
              <CardDescription>
                {t('loginAsGuardian')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/login/guardian/${daycareCode}`}>
                <Button className="w-full" size="lg" data-testid="button-login-guardian">
                  {t('login')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-blue-600">
          <p>{t('selectRole')}</p>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
}
