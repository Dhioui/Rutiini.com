import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useRef } from "react";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Lock, KeyRound, ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { updateUser, needsPasswordChange, user, token, login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const redirectPathRef = useRef('/dashboard');

  const changePasswordFormSchema = z.object({
    currentPassword: z.string().min(1, t('currentPassword')),
    newPassword: z.string().min(8, t('passwordRequirements')),
    confirmPassword: z.string().min(1, t('confirmPassword')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('passwordMismatch'),
    path: ["confirmPassword"],
  }).refine((data) => data.newPassword !== data.currentPassword, {
    message: t('passwordSameAsCurrent'),
    path: ["newPassword"],
  });

  type ChangePasswordFormData = z.infer<typeof changePasswordFormSchema>;

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      // apiRequest already parses the JSON body.
      return (await apiRequest('POST', '/api/auth/change-password', data)) as { token?: string };
    },
    onSuccess: (result) => {
      toast({
        title: t('success'),
        description: t('passwordChanged'),
      });

      // Changing a password ends every session, including this one, so the server
      // returns a replacement token for this device. Storing it keeps the user
      // signed in; previously the page signed them out entirely, which sent someone
      // completing a password change they were required to make all the way back to
      // the municipality picker to start over.
      if (result?.token && user) {
        login(user, result.token);
        updateUser({ passwordNeedsReset: false });
        setLocation(redirectPathRef.current);
        return;
      }

      // No replacement token: the local one is dead, so a fresh sign-in is the only
      // way forward.
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: t('error'),
        description: error.message || t('incorrectCurrentPassword'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    // Aseta ohjausreitti ennen mutatioita
    redirectPathRef.current = user?.role === 'guardian' ? '/messages' : '/dashboard';
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('changePassword')}</CardTitle>
          <CardDescription>
            {needsPasswordChange 
              ? t('firstLoginPasswordChange')
              : t('changePassword')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('currentPassword')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder={t('currentPassword')}
                          className="pl-10"
                          data-testid="input-current-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newPassword')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder={t('passwordRequirements')}
                          className="pl-10"
                          data-testid="input-new-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('confirmPassword')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder={t('confirmPassword')}
                          className="pl-10"
                          data-testid="input-confirm-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={changePasswordMutation.isPending}
                data-testid="button-change-password"
              >
                {changePasswordMutation.isPending ? t('loading') : t('changePassword')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
