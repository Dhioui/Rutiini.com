import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck } from "lucide-react";

/**
 * The page a password reset email links to.
 *
 * The API endpoint and the email both existed; this did not, so the link in the
 * message landed on "page not found" and nobody could ever complete a reset.
 *
 * The token arrives in the query string. It is never displayed and never stored --
 * it is read, posted once, and discarded with the page.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/auth/reset-password", { token, newPassword }),
    onSuccess: () => {
      setDone(true);
      toast({ title: t("success"), description: t("passwordChanged") });
    },
    // The shared handler in queryClient reports the failure; the server's message
    // already distinguishes an expired link from a rejected password.
  });

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    token.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword && !resetMutation.isPending;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t("error")}</CardTitle>
            <CardDescription data-testid="text-reset-missing-token">
              {t("resetLinkInvalid")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/")} data-testid="button-back-home">
              {t("backToLogin")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 text-primary" aria-hidden="true" />
            <CardTitle>{t("passwordChanged")}</CardTitle>
            <CardDescription data-testid="text-reset-done">{t("resetCompleteSignIn")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/")} data-testid="button-go-to-login">
              {t("backToLogin")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <KeyRound className="h-10 w-10 mx-auto mb-2 text-primary" aria-hidden="true" />
          <CardTitle>{t("resetPassword")}</CardTitle>
          <CardDescription>{t("passwordRequirements")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) resetMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
              {tooShort && (
                <p className="text-sm text-destructive" data-testid="text-password-too-short">
                  {t("passwordRequirements")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
              {mismatch && (
                <p className="text-sm text-destructive" data-testid="text-password-mismatch">
                  {t("passwordMismatch")}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit} data-testid="button-reset-password">
              {resetMutation.isPending ? t("submitting") : t("resetPassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
