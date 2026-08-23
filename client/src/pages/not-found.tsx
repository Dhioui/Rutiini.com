import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

export default function NotFound() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold">{t('pageNotFound')}</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {t('pageNotFoundMessage')}
          </p>

          <div className="flex gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('goBack')}
            </Button>
            <Button 
              onClick={() => setLocation('/')}
              data-testid="button-go-home"
            >
              <Home className="h-4 w-4 mr-2" />
              {t('goHome')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
