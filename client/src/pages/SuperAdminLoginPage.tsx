import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Footer } from '@/components/Footer';
import { Shield, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@shared/schema';

export function SuperAdminLoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      return await apiRequest('POST', '/api/auth/super-admin/login', data);
    },
    onSuccess: (data: { token: string; user: User }) => {
      login(data.user, data.token);
      toast({
        title: t('success'),
        description: t('loginSuccess'),
      });
      setLocation('/dashboard');
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('loginError'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="absolute top-4 left-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/')}
            data-testid="button-back-to-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('back')}
          </Button>
        </div>
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>
        <Card className="w-full max-w-md border-0 shadow-lg" data-testid="card-super-admin-login">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-md">
              <Shield className="h-10 w-10" />
            </div>
            <CardTitle className="text-2xl">{t('appName')}</CardTitle>
            <CardDescription>{t('superAdminLogin')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-super-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-super-admin-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-super-admin-login"
              >
                {loginMutation.isPending ? t('loading') : t('login')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
