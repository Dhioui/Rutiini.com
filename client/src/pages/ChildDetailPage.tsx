import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Baby, Moon, Utensils, Palette, AlertTriangle, FileText, TreePine, Clock, Smile } from 'lucide-react';
import { format } from 'date-fns';
import type { Child, Entry } from '@shared/schema';

// Helper function to format entry display - supports both JSON and text formats
function formatEntryValue(entry: Entry, t: (key: string) => string): string {
  // Handle case where value is already an object (legacy database format)
  let rawValue = '';
  let jsonValue: any = null;
  
  if (typeof entry.value === 'object' && entry.value !== null) {
    // Value is already an object from database
    jsonValue = entry.value;
    rawValue = '';
  } else {
    // Value is a string
    rawValue = entry.value || '';
    
    // Try to parse as JSON for legacy string entries
    try {
      if (rawValue.startsWith('{') || rawValue.startsWith('[')) {
        jsonValue = JSON.parse(rawValue);
      }
    } catch {
      // Not JSON, continue with string parsing
    }
  }
  
  switch (entry.type) {
    case 'sleep':
      // Legacy JSON format: {"startTime":"08:00","endTime":"10:00"}
      if (jsonValue && jsonValue.startTime && jsonValue.endTime) {
        return `${t('slept')} ${jsonValue.startTime} - ${jsonValue.endTime}`;
      }
      // New text format: "30min", "1h", "1.5h", "2h" etc.
      if (rawValue.includes('min')) {
        return `${t('slept')} ${rawValue}`;
      }
      if (rawValue.includes('h')) {
        const hours = rawValue.replace('h', '');
        return `${t('slept')} ${hours} ${parseFloat(hours) === 1 ? t('hour') : t('hours')}`;
      }
      return rawValue || t('sleeping');
      
    case 'meal':
      // Legacy JSON format: {"mealType":"breakfast","amount":"good"}
      if (jsonValue && jsonValue.mealType) {
        const legacyMealTypes: Record<string, string> = {
          breakfast: t('breakfast'),
          lunch: t('lunch'),
          snack: t('afternoonSnack'),
          snack1: t('morningSnack'),
          snack2: t('afternoonSnack'),
          dessert: t('dessert'),
          dinner: t('dinner'),
          milk: t('milk')
        };
        const legacyAmounts: Record<string, string> = {
          good: t('full'),
          some: t('half'),
          none: t('none'),
          full: t('full'),
          half: t('half')
        };
        const mealName = legacyMealTypes[jsonValue.mealType] || jsonValue.mealType;
        const amountText = legacyAmounts[jsonValue.amount] || '';
        return amountText ? `${mealName} - ${amountText}` : mealName;
      }
      // New text format: "breakfast:full", "lunch:half", "snack1:none" etc.
      const mealTypes: Record<string, string> = {
        breakfast: t('breakfast'),
        snack: t('afternoonSnack'),
        snack1: t('morningSnack'),
        lunch: t('lunch'),
        dessert: t('dessert'),
        snack2: t('afternoonSnack'),
        dinner: t('dinner'),
        milk: t('milk')
      };
      const portions: Record<string, string> = {
        full: t('full'),
        half: t('half'),
        none: t('none'),
        good: t('full'),
        some: t('half')
      };
      
      if (rawValue.includes(':')) {
        const [mealId, portion] = rawValue.split(':');
        const mealName = mealTypes[mealId] || mealId;
        if (portion) {
          const portionText = portions[portion] || portion;
          return `${mealName} - ${portionText}`;
        }
        return mealName;
      }
      // Fallback for simple text values or meal names
      return mealTypes[rawValue] || rawValue;
      
    case 'play':
    case 'activity':
      // Unified activity mapping for both legacy and new formats
      const allActivities: Record<string, string> = {
        outdoor: t('activityOutdoor'),
        indoor: t('activityIndoor'),
        art: t('activityCraft'),
        craft: t('activityCraft'),
        reading: t('activityReading'),
        music: t('activityMusic'),
        sport: t('activitySport'),
        sports: t('activitySport'),
        games: t('games')
      };
      
      // Legacy JSON format: {"activityType":"outdoor"}
      if (jsonValue && jsonValue.activityType) {
        return allActivities[jsonValue.activityType] || jsonValue.activityType;
      }
      // New text format: "outdoor", "indoor", "art", "music", etc.
      return allActivities[rawValue] || rawValue;
    
    case 'arrival':
      // Unified mood mapping for both legacy and new formats
      const arrivalMapping = (timeVal: string) => {
        if (timeVal) {
          return `${t('arrivedAt')} ${timeVal}`;
        }
        return '';
      };
      
      // Legacy JSON format: {"time":"08:30"}
      if (jsonValue && jsonValue.time) {
        return arrivalMapping(jsonValue.time);
      }
      // New text format: plain time string like "08:30"
      if (rawValue && rawValue.includes(':')) {
        return arrivalMapping(rawValue);
      }
      return rawValue;
    
    case 'mood':
      // Unified mood mapping for both legacy and new formats
      const moods: Record<string, string> = {
        happy: t('moodHappy'),
        calm: t('moodCalm'),
        tired: t('moodTired'),
        sad: t('moodSad')
      };
      
      // Legacy JSON format: {"mood":"happy"}
      if (jsonValue && jsonValue.mood) {
        return moods[jsonValue.mood] || jsonValue.mood;
      }
      // New text format: plain mood string like "happy"
      return moods[rawValue] || rawValue;
      
    case 'incident':
      // Incidents use the note field for the actual content
      return entry.note || rawValue;
      
    default:
      return entry.note || rawValue;
  }
}

export function ChildDetailPage() {
  const { t } = useTranslation();
  
  const entryTypeLabels: Record<string, string> = {
    sleep: t('sleep'),
    meal: t('meal'),
    activity: t('activity'),
    arrival: t('arrival'),
    mood: t('mood'),
    play: t('play'),
    incident: t('incident')
  };
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const { data: children, isLoading: childrenLoading } = useQuery<Child[]>({
    queryKey: ['/api/children'],
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: ['/api/children', id, 'entries'],
    enabled: !!id,
  });

  const child = children?.find(c => c.id === parseInt(id || '0'));

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getEntryIcon = (type: string) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'sleep':
        return <div className="rounded-full bg-blue-500/10 p-2"><Moon className={`${iconClass} text-blue-500`} /></div>;
      case 'meal':
        return <div className="rounded-full bg-green-500/10 p-2"><Utensils className={`${iconClass} text-green-500`} /></div>;
      case 'play':
        return <div className="rounded-full bg-purple-500/10 p-2"><Palette className={`${iconClass} text-purple-500`} /></div>;
      case 'incident':
        return <div className="rounded-full bg-orange-500/10 p-2"><AlertTriangle className={`${iconClass} text-orange-500`} /></div>;
      default:
        return <div className="rounded-full bg-muted p-2"><FileText className={`${iconClass} text-muted-foreground`} /></div>;
    }
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

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" onClick={() => setLocation('/children')} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('children')}
        </Button>
      </div>

      <Card className="border-0 shadow-md" data-testid="card-child-info">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 shadow-md">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {getInitials(child.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl" data-testid="text-child-name">{child.name}</CardTitle>
              <CardDescription data-testid="text-child-age">
                {calculateAge(child.birthdate)} {t('age').toLowerCase()} • {format(new Date(child.birthdate), 'dd.MM.yyyy')}
              </CardDescription>
              {child.groupId && (
                <Badge variant="secondary" className="mt-2" data-testid="badge-child-group">
                  {t('group')} {child.groupId}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-0 shadow-md" data-testid="card-entries">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-primary" />
            {t('todaysEntries')}
          </CardTitle>
          <CardDescription>
            {entries?.filter(e => {
              const today = new Date().toDateString();
              return new Date(e.timestamp).toDateString() === today;
            }).length || 0} {t('todaysEntries').toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-3" data-testid="list-entries">
              {entries.map((entry) => {
                const displayValue = formatEntryValue(entry, t);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 rounded-xl bg-muted/50 p-4"
                    data-testid={`entry-${entry.id}`}
                  >
                    {getEntryIcon(entry.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm">{entryTypeLabels[entry.type] || entry.type}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.timestamp), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{displayValue}</p>
                      {entry.note && displayValue !== entry.note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{entry.note}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Baby className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{t('noEntries')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
