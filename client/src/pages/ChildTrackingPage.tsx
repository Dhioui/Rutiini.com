import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Baby, Plus, Moon, Utensils, Gamepad2, AlertTriangle, Coffee, Apple, Sandwich, Cookie, IceCreamCone, Milk, Check, Minus, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import type { Child, Entry } from '@shared/schema';

export function ChildTrackingPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [sleepValue, setSleepValue] = useState('');
  const [playActivity, setPlayActivity] = useState('');
  const [incidentNote, setIncidentNote] = useState('');

  const { data: children, isLoading: childrenLoading } = useQuery<Child[]>({
    queryKey: ['/api/children'],
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: ['/api/children', id, 'entries'],
    enabled: !!id,
  });

  const child = children?.find(c => c.id === parseInt(id || '0'));

  const createEntryMutation = useMutation({
    mutationFn: async (data: { childId: number; type: string; value: string; note: string; staffId: number }) => {
      return await apiRequest('POST', '/api/entries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/children', id, 'entries'] });
      toast({
        title: t('success'),
        description: t('entryCreated'),
      });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateAge = (birthdate: string) => {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const mealTypes = [
    { id: 'breakfast', icon: Coffee, label: t('breakfast') },
    { id: 'snack1', icon: Apple, label: t('morningSnack') },
    { id: 'lunch', icon: Sandwich, label: t('lunch') },
    { id: 'dessert', icon: Cookie, label: t('dessert') },
    { id: 'snack2', icon: IceCreamCone, label: t('afternoonSnack') },
    { id: 'milk', icon: Milk, label: t('milk') },
  ];

  const todaysEntries = entries?.filter(e => {
    const today = new Date().toDateString();
    return new Date(e.timestamp).toDateString() === today;
  }) || [];

  const sleepEntries = todaysEntries.filter(e => e.type === 'sleep');

  const handleMealClick = (mealId: string, portion: string) => {
    if (!user || !child) return;
    createEntryMutation.mutate({
      childId: child.id,
      type: 'meal',
      value: `${mealId}:${portion}`,
      note: '',
      staffId: user.id,
    });
  };

  const getMealStatus = (mealId: string) => {
    const mealEntries = todaysEntries
      .filter(e => e.type === 'meal' && e.value.startsWith(mealId + ':'))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (mealEntries.length === 0) return null;
    
    const latestEntry = mealEntries[0];
    const portion = latestEntry.value.split(':')[1];
    return { portion, timestamp: latestEntry.timestamp };
  };

  const handleAddSleep = () => {
    if (!user || !child || !sleepValue) return;
    createEntryMutation.mutate({
      childId: child.id,
      type: 'sleep',
      value: sleepValue,
      note: '',
      staffId: user.id,
    });
    setSleepValue('');
  };

  const handleAddPlay = () => {
    if (!user || !child || !playActivity) return;
    createEntryMutation.mutate({
      childId: child.id,
      type: 'play',
      value: playActivity,
      note: '',
      staffId: user.id,
    });
    setPlayActivity('');
  };

  const handleAddIncident = () => {
    if (!user || !child || !incidentNote) return;
    createEntryMutation.mutate({
      childId: child.id,
      type: 'incident',
      value: 'incident',
      note: incidentNote,
      staffId: user.id,
    });
    setIncidentNote('');
  };

  if (childrenLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Baby className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t('noChildren')}</p>
        <Button className="mt-4" onClick={() => setLocation('/children')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('children')}
        </Button>
      </div>
    );
  }

  const canEdit = user?.role === 'daycareleader' || user?.role === 'staff' || user?.role === 'super_admin';

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/children')} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary" data-testid="avatar-child">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {getInitials(child.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-child-name">{child.name}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-child-age">
              {calculateAge(child.birthdate)} {t('age').toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-md" data-testid="card-meals">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                {t('meals')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-meals-subtitle">
                {t('trackMealsToday')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {mealTypes.map((meal) => {
            const MealIcon = meal.icon;
            const status = getMealStatus(meal.id);
            const bgColors: Record<string, string> = {
              breakfast: 'bg-amber-100 dark:bg-amber-900/30',
              snack1: 'bg-green-100 dark:bg-green-900/30',
              lunch: 'bg-orange-100 dark:bg-orange-900/30',
              dessert: 'bg-pink-100 dark:bg-pink-900/30',
              snack2: 'bg-purple-100 dark:bg-purple-900/30',
              milk: 'bg-blue-100 dark:bg-blue-900/30',
            };
            const iconColors: Record<string, string> = {
              breakfast: 'text-amber-600',
              snack1: 'text-green-600',
              lunch: 'text-orange-600',
              dessert: 'text-pink-600',
              snack2: 'text-purple-600',
              milk: 'text-blue-600',
            };
            
            return (
              <div 
                key={meal.id} 
                className={`rounded-xl p-4 ${bgColors[meal.id] || 'bg-muted'}`}
                data-testid={`card-meal-${meal.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-white/80 dark:bg-black/20 ${iconColors[meal.id]}`}>
                      <MealIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium" data-testid={`text-meal-name-${meal.id}`}>{meal.label}</p>
                      {status && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-meal-time-${meal.id}`}>
                          <Clock className="h-3 w-3" />
                          {format(new Date(status.timestamp), 'HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={status?.portion === 'full' ? 'default' : 'outline'}
                        className="gap-1"
                        onClick={() => handleMealClick(meal.id, 'full')}
                        disabled={createEntryMutation.isPending}
                        data-testid={`button-meal-${meal.id}-full`}
                      >
                        <Check className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('full')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={status?.portion === 'half' ? 'default' : 'outline'}
                        className="gap-1"
                        onClick={() => handleMealClick(meal.id, 'half')}
                        disabled={createEntryMutation.isPending}
                        data-testid={`button-meal-${meal.id}-half`}
                      >
                        <Minus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('half')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={status?.portion === 'none' ? 'destructive' : 'outline'}
                        className="gap-1"
                        onClick={() => handleMealClick(meal.id, 'none')}
                        disabled={createEntryMutation.isPending}
                        data-testid={`button-meal-${meal.id}-none`}
                      >
                        <X className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('none')}</span>
                      </Button>
                    </div>
                  )}
                  
                  {!canEdit && status && (
                    <Badge 
                      variant={status.portion === 'full' ? 'default' : status.portion === 'half' ? 'secondary' : 'destructive'}
                      data-testid={`badge-meal-status-${meal.id}`}
                    >
                      {status.portion === 'full' && t('full')}
                      {status.portion === 'half' && t('half')}
                      {status.portion === 'none' && t('none')}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md" data-testid="card-sleep">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-500" />
            {t('sleep')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 mb-4" data-testid="chart-sleep">
            <div className="flex items-end gap-1 h-20 justify-center">
              {Array.from({ length: 24 }).map((_, i) => {
                const hasSleep = sleepEntries.some(e => {
                  const hour = new Date(e.timestamp).getHours();
                  return hour === i;
                });
                return (
                  <div
                    key={i}
                    className={`w-2 rounded-t transition-all ${hasSleep ? 'bg-primary h-full' : 'bg-muted-foreground/20 h-4'}`}
                    title={`${i}:00`}
                    data-testid={`bar-sleep-hour-${i}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Select value={sleepValue} onValueChange={setSleepValue}>
                <SelectTrigger className="flex-1" data-testid="select-sleep">
                  <SelectValue placeholder={t('selectSleepDuration')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30min">30 min</SelectItem>
                  <SelectItem value="1h">1 {t('hour')}</SelectItem>
                  <SelectItem value="1.5h">1.5 {t('hours')}</SelectItem>
                  <SelectItem value="2h">2 {t('hours')}</SelectItem>
                  <SelectItem value="2.5h">2.5 {t('hours')}</SelectItem>
                  <SelectItem value="3h">3 {t('hours')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon"
                onClick={handleAddSleep}
                disabled={!sleepValue || createEntryMutation.isPending}
                data-testid="button-add-sleep"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md" data-testid="card-play">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-green-500" />
            {t('playActivities')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit && (
            <div className="flex gap-2">
              <Select value={playActivity} onValueChange={setPlayActivity}>
                <SelectTrigger className="flex-1" data-testid="select-activity">
                  <SelectValue placeholder={t('selectActivity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outdoor">{t('outdoorPlay')}</SelectItem>
                  <SelectItem value="indoor">{t('indoorPlay')}</SelectItem>
                  <SelectItem value="art">{t('artsCrafts')}</SelectItem>
                  <SelectItem value="music">{t('music')}</SelectItem>
                  <SelectItem value="reading">{t('reading')}</SelectItem>
                  <SelectItem value="sports">{t('sports')}</SelectItem>
                  <SelectItem value="games">{t('games')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon"
                onClick={handleAddPlay}
                disabled={!playActivity || createEntryMutation.isPending}
                data-testid="button-add-activity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3" data-testid="list-activities">
            {todaysEntries.filter(e => e.type === 'play').map((entry) => (
              <Badge key={entry.id} variant="secondary" data-testid={`badge-activity-${entry.id}`}>
                {t(entry.value) || entry.value}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md" data-testid="card-incidents">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('incidentsNotes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit && (
            <div className="space-y-2">
              <Textarea
                placeholder={t('freeFormNotes')}
                value={incidentNote}
                onChange={(e) => setIncidentNote(e.target.value)}
                className="min-h-[80px] resize-none"
                data-testid="textarea-incident"
              />
              <Button
                onClick={handleAddIncident}
                disabled={!incidentNote || createEntryMutation.isPending}
                className="w-full"
                data-testid="button-add-incident"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('addNote')}
              </Button>
            </div>
          )}
          <div className="space-y-2 mt-3" data-testid="list-incidents">
            {todaysEntries.filter(e => e.type === 'incident').map((entry) => (
              <div key={entry.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3" data-testid={`card-incident-${entry.id}`}>
                <p className="text-sm" data-testid={`text-incident-note-${entry.id}`}>{entry.note}</p>
                <p className="text-xs text-muted-foreground mt-1" data-testid={`text-incident-time-${entry.id}`}>
                  {format(new Date(entry.timestamp), 'HH:mm')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!canEdit && todaysEntries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">{t('noEntriesToday')}</p>
        </div>
      )}
    </div>
  );
}
