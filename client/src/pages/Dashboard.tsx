import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Baby, ClipboardList, Bus, Users, Building2, ShieldCheck, BarChart3, Moon, Utensils, TreePine, Clock, Smile, Calendar, FileText, TrendingUp, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { Child, Entry, Trip, Daycare } from '@shared/schema';

interface DaycareKPIStats {
  childrenCount: number;
  staffCount: number;
  guardianCount: number;
  absencesToday: number;
  attendanceRate: number;
  entriesToday: number;
  entryBreakdown: {
    sleep: number;
    meal: number;
    activity: number;
    arrival: number;
    mood: number;
  };
  activeTrips: number;
  pendingForms: number;
}

// Helper function to format entry display
function formatEntryDisplay(entry: Entry, t: (key: string) => string) {
  let value: any = {};
  try {
    value = typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value;
  } catch {
    value = {};
  }

  const typeConfig: Record<string, { icon: typeof Moon; color: string; bgColor: string }> = {
    sleep: { icon: Moon, color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
    meal: { icon: Utensils, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
    activity: { icon: TreePine, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    arrival: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    mood: { icon: Smile, color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
  };

  const config = typeConfig[entry.type] || { icon: ClipboardList, color: 'text-gray-600', bgColor: 'bg-gray-100' };
  const Icon = config.icon;

  let displayText = '';
  
  switch (entry.type) {
    case 'sleep':
      if (value.startTime && value.endTime) {
        displayText = `${value.startTime} - ${value.endTime}`;
      }
      break;
    case 'meal':
      const mealTypes: Record<string, string> = {
        breakfast: t('mealBreakfast'),
        lunch: t('mealLunch'),
        snack: t('mealSnack'),
        dinner: t('mealDinner')
      };
      const amounts: Record<string, string> = {
        good: t('ateWell'),
        some: t('ateSome'),
        none: t('didNotEat')
      };
      const mealName = mealTypes[value.mealType] || value.mealType || '';
      const amountText = amounts[value.amount] || '';
      displayText = amountText ? `${mealName} - ${amountText}` : mealName;
      break;
    case 'activity':
      const activities: Record<string, string> = {
        outdoor: t('activityOutdoor'),
        indoor: t('activityIndoor'),
        craft: t('activityCraft'),
        reading: t('activityReading'),
        music: t('activityMusic'),
        sport: t('activitySport')
      };
      displayText = activities[value.activityType] || value.activityType || '';
      break;
    case 'arrival':
      displayText = value.time ? `${t('arrivedAt')} ${value.time}` : '';
      break;
    case 'mood':
      const moods: Record<string, string> = {
        happy: t('moodHappy'),
        calm: t('moodCalm'),
        tired: t('moodTired'),
        sad: t('moodSad')
      };
      displayText = moods[value.mood] || value.mood || '';
      break;
    default:
      displayText = entry.note || '';
  }

  // Add note if exists
  if (entry.note && entry.type !== 'mood') {
    displayText = displayText ? `${displayText}` : entry.note;
  }

  const typeLabels: Record<string, string> = {
    sleep: t('entrySleep'),
    meal: t('entryMeal'),
    activity: t('entryActivity'),
    arrival: t('entryArrival'),
    mood: t('entryMood')
  };

  return { Icon, config, displayText, typeLabel: typeLabels[entry.type] || entry.type };
}

interface AnonymizedStats {
  totalDaycares: number;
  totalChildren: number;
  totalStaff: number;
  totalGuardians: number;
  totalTrips: number;
  totalAbsencesToday: number;
  daycareStats: Array<{
    daycareId: number;
    daycareName: string;
    childrenCount: number;
    staffCount: number;
    guardianCount: number;
  }>;
}

function SuperAdminDashboard() {
  const { t } = useTranslation();

  const { data: daycares, isLoading: daycaresLoading } = useQuery<Daycare[]>({
    queryKey: ['/api/daycares'],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AnonymizedStats>({
    queryKey: ['/api/super-admin/stats'],
  });

  const isLoading = daycaresLoading || statsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">{t('dashboard')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('gdprCompliantView')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-0 shadow-md" data-testid="card-stat-daycares">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalDaycares')}</CardTitle>
            <div className="rounded-md p-2 bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-stat-daycares">
                {stats?.totalDaycares || daycares?.length || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-children">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalChildren')}</CardTitle>
            <div className="rounded-md p-2 bg-green-100 dark:bg-green-900/30">
              <Baby className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-stat-children">
                {stats?.totalChildren || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-staff">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalStaff')}</CardTitle>
            <div className="rounded-md p-2 bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-stat-staff">
                {stats?.totalStaff || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-guardians">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalGuardians')}</CardTitle>
            <div className="rounded-md p-2 bg-orange-100 dark:bg-orange-900/30">
              <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-stat-guardians">
                {stats?.totalGuardians || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-md" data-testid="card-admin-management">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t('adminManagement')}
            </CardTitle>
            <CardDescription>
              {t('manageDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('createAdminDescription')}
            </p>
            <Link href="/super-admin/users">
              <Button data-testid="link-manage-admins">
                {t('manageAdmins')}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stats-reports">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('statsAndReports')}
            </CardTitle>
            <CardDescription>
              {t('anonymizedSystemStats')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('gdprNote')}
            </p>
            <Link href="/super-admin/stats">
              <Button variant="outline" data-testid="link-view-stats">
                {t('viewStats')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md" data-testid="card-daycares-overview">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t('daycaresOverview')}
          </CardTitle>
          <CardDescription>
            {t('anonymizedSummary')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : stats?.daycareStats && stats.daycareStats.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.daycareStats.map((dc) => (
                <div
                  key={dc.daycareId}
                  className="rounded-lg border p-4 hover-elevate"
                  data-testid={`card-daycare-stat-${dc.daycareId}`}
                >
                  <h4 className="font-semibold mb-2">{dc.daycareName}</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-primary">{dc.childrenCount}</div>
                      <div className="text-xs text-muted-foreground">{t('children')}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-primary">{dc.staffCount}</div>
                      <div className="text-xs text-muted-foreground">{t('staff')}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-primary">{dc.guardianCount}</div>
                      <div className="text-xs text-muted-foreground">{t('guardians')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('noDaycaresCreate')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RegularDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isDaycareLeader = user?.role === 'daycareleader';

  const { data: children, isLoading: childrenLoading } = useQuery<Child[]>({
    queryKey: ['/api/children'],
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: ['/api/entries'],
  });

  const { data: trips, isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ['/api/trips'],
  });

  const { data: daycareStats, isLoading: statsLoading } = useQuery<DaycareKPIStats>({
    queryKey: ['/api/daycare/stats'],
    enabled: isDaycareLeader,
  });

  const stats = isDaycareLeader && daycareStats ? [
    {
      title: t('children'),
      value: daycareStats.childrenCount,
      icon: Baby,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: t('attendanceRate'),
      value: `${daycareStats.attendanceRate}%`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: t('absencesToday'),
      value: daycareStats.absencesToday,
      icon: Calendar,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: t('todaysEntries'),
      value: daycareStats.entriesToday,
      icon: ClipboardList,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      title: t('activeTrips'),
      value: daycareStats.activeTrips,
      icon: Bus,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: t('activeForms'),
      value: daycareStats.pendingForms,
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ] : [
    {
      title: t('children'),
      value: children?.length || 0,
      icon: Baby,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: t('todaysEntries'),
      value: entries?.filter(e => {
        const today = new Date().toDateString();
        return new Date(e.timestamp).toDateString() === today;
      }).length || 0,
      icon: ClipboardList,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: t('upcomingTrips'),
      value: trips?.filter(t => new Date(t.date) >= new Date()).length || 0,
      icon: Bus,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  const isLoading = childrenLoading || entriesLoading || tripsLoading || (isDaycareLeader && statsLoading);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
        <div className="text-muted-foreground mt-1 flex items-center gap-2">
          <span>{t('appTagline')} -</span>
          <Badge variant="secondary">{t(user?.role || 'guardian')}</Badge>
        </div>
      </div>

      <div className={`grid gap-6 ${isDaycareLeader ? 'md:grid-cols-3 lg:grid-cols-6' : 'md:grid-cols-3'}`}>
        {stats.map((stat, index) => (
          <Card key={stat.title} className="border-0 shadow-md" data-testid={`card-stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`rounded-md p-2 ${stat.bgColor} dark:opacity-80`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid={`text-stat-value-${index}`}>{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isDaycareLeader && daycareStats && (
        <Card className="border-0 shadow-md" data-testid="card-entry-breakdown">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('entryBreakdown')}
            </CardTitle>
            <CardDescription>{t('todaysEntryTypes')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <Moon className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                <div className="text-xl font-bold">{daycareStats.entryBreakdown.sleep}</div>
                <div className="text-xs text-muted-foreground">{t('entrySleep')}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Utensils className="h-5 w-5 mx-auto text-orange-600 mb-1" />
                <div className="text-xl font-bold">{daycareStats.entryBreakdown.meal}</div>
                <div className="text-xs text-muted-foreground">{t('entryMeal')}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <TreePine className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <div className="text-xl font-bold">{daycareStats.entryBreakdown.activity}</div>
                <div className="text-xs text-muted-foreground">{t('entryActivity')}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                <div className="text-xl font-bold">{daycareStats.entryBreakdown.arrival}</div>
                <div className="text-xs text-muted-foreground">{t('entryArrival')}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                <Smile className="h-5 w-5 mx-auto text-pink-600 mb-1" />
                <div className="text-xl font-bold">{daycareStats.entryBreakdown.mood}</div>
                <div className="text-xs text-muted-foreground">{t('entryMood')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isDaycareLeader && (
        <Card className="border-0 shadow-md" data-testid="card-exports">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              {t('exportReports')}
            </CardTitle>
            <CardDescription>{t('exportReportsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/api/export/children'}
                data-testid="button-export-children"
              >
                <Baby className="h-4 w-4 mr-2" />
                {t('children')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/api/export/entries'}
                data-testid="button-export-entries"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                {t('entries')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/api/export/absences'}
                data-testid="button-export-absences"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {t('absences')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/api/export/attendance'}
                data-testid="button-export-attendance"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {t('attendance')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-md" data-testid="card-todays-entries">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
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
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : entries && entries.length > 0 ? (
              <div className="space-y-3" data-testid="list-todays-entries">
                {entries
                  .filter(e => {
                    const today = new Date().toDateString();
                    return new Date(e.timestamp).toDateString() === today;
                  })
                  .slice(0, 5)
                  .map((entry) => {
                    const { Icon, config, displayText, typeLabel } = formatEntryDisplay(entry, t);
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 rounded-xl bg-muted/50 p-4"
                        data-testid={`card-entry-${entry.id}`}
                      >
                        <div className={`rounded-lg p-2.5 ${config.bgColor}`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{typeLabel}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{displayText}</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('noEntries')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-upcoming-trips">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" />
              {t('upcomingTrips')}
            </CardTitle>
            <CardDescription>
              {trips?.filter(t => new Date(t.date) >= new Date()).length || 0} {t('upcomingTrips').toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tripsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : trips && trips.length > 0 ? (
              <div className="space-y-2" data-testid="list-upcoming-trips">
                {trips
                  .filter(t => new Date(t.date) >= new Date())
                  .slice(0, 5)
                  .map((trip) => (
                    <div
                      key={trip.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                      data-testid={`card-trip-preview-${trip.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{trip.title}</p>
                        <p className="text-xs text-muted-foreground">{trip.location}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(trip.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('noTrips')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  return <RegularDashboard />;
}
