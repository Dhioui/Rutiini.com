import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { UtensilsCrossed, Coffee, Apple, RefreshCw, Calendar, Info, Leaf } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fi, enUS, sv, ar, ru } from "date-fns/locale";

interface MealMenuItem {
  id: number;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'vegetarian_lunch' | 'snack';
  foodName: string;
  foodDescription?: string;
  dietInfo?: string;
  sourceUrl?: string;
  scrapedAt: string;
}

interface MenuResponse {
  date: string;
  items: MealMenuItem[];
  menuSourceType?: string;
  dietLegend: Record<string, { fi: string; en: string }>;
}

interface WeekMenuResponse {
  startDate: string;
  endDate: string;
  menuByDate: Record<string, MealMenuItem[]>;
  dietLegend: Record<string, { fi: string; en: string }>;
}

const mealTypeIcons: Record<string, typeof UtensilsCrossed> = {
  breakfast: Coffee,
  lunch: UtensilsCrossed,
  vegetarian_lunch: Leaf,
  snack: Apple,
};

const mealTypeColors: Record<string, string> = {
  breakfast: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  lunch: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  vegetarian_lunch: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  snack: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

const dietBadgeColors: Record<string, string> = {
  L: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  M: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  G: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  N: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  S: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  K: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Veg: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  '♥': 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
};

const getDateLocale = (lang: string) => {
  switch (lang) {
    case 'fi': return fi;
    case 'sv': return sv;
    case 'ar': return ar;
    case 'ru': return ru;
    default: return enUS;
  }
};

export function MealMenuPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today');
  const canRefreshMenu = user?.role === 'daycareleader' || user?.role === 'staff' || user?.role === 'admin';

  const { data: todayMenuData, isLoading: todayLoading, error: todayError, refetch: refetchToday } = useQuery<MenuResponse>({
    queryKey: ['/api/menu'],
    enabled: viewMode === 'today',
  });

  const { data: weekMenuData, isLoading: weekLoading, error: weekError, refetch: refetchWeek } = useQuery<WeekMenuResponse>({
    queryKey: ['/api/menu/week'],
    enabled: viewMode === 'week',
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/menu/refresh');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
      queryClient.invalidateQueries({ queryKey: ['/api/menu/week'] });
      toast({
        title: t('menuRefreshed'),
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('menuRefreshFailed'),
        variant: 'destructive',
      });
    },
  });

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    const locale = getDateLocale(i18n.language);
    return format(date, 'EEEE, d. MMMM', { locale });
  };

  const formatShortDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    const locale = getDateLocale(i18n.language);
    return format(date, 'EEE d.M.', { locale });
  };

  const getMealTypeLabel = (mealType: string): string => {
    switch (mealType) {
      case 'breakfast': return t('menuBreakfast');
      case 'lunch': return t('menuLunch');
      case 'vegetarian_lunch': return t('menuVegetarianLunch');
      case 'snack': return t('menuSnack');
      default: return mealType;
    }
  };

  const getDietLabel = (code: string): string => {
    const legend = todayMenuData?.dietLegend?.[code] || weekMenuData?.dietLegend?.[code];
    if (legend) {
      return i18n.language === 'fi' ? legend.fi : legend.en;
    }
    return code;
  };

  const renderMealCard = (item: MealMenuItem, mealType: string) => {
    const Icon = mealTypeIcons[mealType];
    const colorClass = mealTypeColors[mealType];
    
    // Safety check for empty food names
    if (!item.foodName || item.foodName.trim() === '') {
      return null;
    }
    
    return (
      <Card key={`${item.date}-${mealType}`} className="border-0 shadow-md hover-elevate" data-testid={`card-meal-${mealType}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">{getMealTypeLabel(mealType)}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1.5" data-testid={`text-food-${mealType}`}>
            {item.foodName.split(' | ').map((foodItem, idx) => {
              const parts = foodItem.match(/^(.+?)\s+([LMGNSK,\s♥]+(?:Veg)?)$/);
              if (parts) {
                const name = parts[1].trim();
                const codes = parts[2].split(',').map(c => c.trim()).filter(c => c.length > 0);
                return (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{name}</span>
                    {codes.map((code, codeIdx) => (
                      <Badge
                        key={`${code}-${codeIdx}`}
                        variant="outline"
                        className={`text-xs py-0 px-1.5 ${dietBadgeColors[code] || ''}`}
                        title={getDietLabel(code)}
                      >
                        {code}
                      </Badge>
                    ))}
                  </div>
                );
              }
              return <div key={idx} className="font-medium">{foodItem}</div>;
            })}
          </div>
          {item.foodDescription && (
            <p className="text-sm text-muted-foreground">{item.foodDescription}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderDayMenu = (items: MealMenuItem[], showDate?: boolean, dateStr?: string) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          {t('noMenuForDay')}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {showDate && dateStr && (
          <h3 className="font-semibold text-lg capitalize" data-testid={`text-date-${dateStr}`}>
            {formatDate(dateStr)}
          </h3>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {['breakfast', 'lunch', 'vegetarian_lunch', 'snack'].map((mealType) => {
            const item = items.find(i => i.mealType === mealType);
            if (!item) return null;
            return renderMealCard(item, mealType);
          })}
        </div>
      </div>
    );
  };

  const isLoading = viewMode === 'today' ? todayLoading : weekLoading;
  const error = viewMode === 'today' ? todayError : weekError;
  const refetch = viewMode === 'today' ? refetchToday : refetchWeek;
  const dietLegend = viewMode === 'today' ? todayMenuData?.dietLegend : weekMenuData?.dietLegend;

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">{t('menuLoadError')}</p>
            <Button onClick={() => refetch()} className="mt-4" data-testid="button-retry-menu">
              {t('tryAgain')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <UtensilsCrossed className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-menu-title">{t('mealMenu')}</h1>
            {viewMode === 'today' && todayMenuData && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(todayMenuData.date)}
              </p>
            )}
            {viewMode === 'week' && weekMenuData && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatShortDate(weekMenuData.startDate)} - {formatShortDate(weekMenuData.endDate)}
              </p>
            )}
          </div>
        </div>
        
        {canRefreshMenu && (
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh-menu"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            {t('refreshMenu')}
          </Button>
        )}
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'today' | 'week')} className="w-full">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="today" data-testid="tab-today">{t('menuToday')}</TabsTrigger>
          <TabsTrigger value="week" data-testid="tab-week">{t('menuWeek')}</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-0 shadow-md">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : todayMenuData && todayMenuData.items.length > 0 ? (
            renderDayMenu(todayMenuData.items)
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-menu">{t('noMenuAvailable')}</p>
                {canRefreshMenu && (
                  <Button
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="mt-4"
                    data-testid="button-fetch-menu"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                    {t('fetchMenu')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-6">
          {weekLoading ? (
            <div className="space-y-8">
              {[1, 2, 3].map((day) => (
                <div key={day} className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2].map((i) => (
                      <Card key={i} className="border-0 shadow-md">
                        <CardHeader className="pb-2">
                          <Skeleton className="h-6 w-32" />
                        </CardHeader>
                        <CardContent>
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-3/4" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : weekMenuData && Object.keys(weekMenuData.menuByDate).length > 0 ? (
            <div className="space-y-8">
              {Object.entries(weekMenuData.menuByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .filter(([dateStr]) => {
                  // Filter out weekends (Saturday = 6, Sunday = 0)
                  const dayOfWeek = parseISO(dateStr).getDay();
                  return dayOfWeek !== 0 && dayOfWeek !== 6;
                })
                .map(([dateStr, items]) => (
                  <div key={dateStr}>
                    {renderDayMenu(items, true, dateStr)}
                  </div>
                ))}
            </div>
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-week-menu">{t('noWeekMenuAvailable')}</p>
                {canRefreshMenu && (
                  <Button
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="mt-4"
                    data-testid="button-fetch-week-menu"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                    {t('fetchMenu')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {dietLegend && Object.keys(dietLegend).length > 0 && (
        <Card className="border-0 shadow-md bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-2">
                <p>{t('menuDietLegend')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dietLegend).map(([code, labels]) => (
                    <span key={code} className="inline-flex items-center gap-1">
                      <Badge variant="outline" className={`text-xs ${dietBadgeColors[code] || ''}`}>
                        {code}
                      </Badge>
                      <span>{i18n.language === 'fi' ? labels.fi : labels.en}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MealMenuPage;
