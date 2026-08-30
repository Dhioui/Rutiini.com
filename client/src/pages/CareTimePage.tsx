import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, ChevronLeft, ChevronRight, Lock, Repeat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Child, AttendanceReservation, ReservationTemplate } from '@shared/schema';

/** Monday of the week containing `date`, as YYYY-MM-DD. */
function weekStart(date: Date): string {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const isoWeekday = ((date.getDay() + 6) % 7) + 1; // 1 = Monday
  return new Date(utc - (isoWeekday - 1) * 86_400_000).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export function CareTimePage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [monday, setMonday] = useState(() => weekStart(new Date()));
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const { data: children } = useQuery<Child[]>({ queryKey: ['/api/children'] });

  const childId = selectedChildId ? Number(selectedChildId) : children?.[0]?.id;
  const sunday = addDays(monday, 6);

  const { data: reservations, isLoading } = useQuery<AttendanceReservation[]>({
    queryKey: ['/api/care-time/reservations', monday, sunday],
    queryFn: async () =>
      await apiRequest('GET', `/api/care-time/reservations?from=${monday}&to=${sunday}`),
  });

  const { data: template } = useQuery<ReservationTemplate[]>({
    queryKey: ['/api/care-time/template', childId],
    queryFn: async () => await apiRequest('GET', `/api/care-time/template/${childId}`),
    enabled: Boolean(childId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/care-time/reservations'] });
    queryClient.invalidateQueries({ queryKey: ['/api/care-time/template'] });
  };

  const saveReservation = useMutation({
    mutationFn: async (body: { childId: number; date: string; startTime: string; endTime: string }) =>
      await apiRequest('PUT', '/api/care-time/reservations', body),
    onSuccess: () => {
      invalidate();
      toast({ title: t('success'), description: t('reservationSaved') });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        // A closed week is the expected refusal, not a failure, so it is named.
        description: /closed/i.test(error?.message ?? '') ? t('reservationsClosed') : t('reservationSaveFailed'),
        variant: 'destructive',
      });
    },
  });

  const removeReservation = useMutation({
    mutationFn: async (body: { childId: number; date: string }) =>
      await apiRequest('DELETE', `/api/care-time/reservations?childId=${body.childId}&date=${body.date}`, {}),
    onSuccess: () => {
      invalidate();
      toast({ title: t('success'), description: t('reservationRemoved') });
    },
    onError: () => toast({ title: t('error'), description: t('reservationsClosed'), variant: 'destructive' }),
  });

  const saveTemplate = useMutation({
    mutationFn: async (body: { childId: number; days: Array<{ weekday: number; startTime: string; endTime: string }> }) =>
      await apiRequest('PUT', '/api/care-time/template', body),
    onSuccess: () => {
      invalidate();
      toast({ title: t('success'), description: t('templateSaved') });
    },
  });

  const applyTemplate = useMutation({
    mutationFn: async (body: { childId: number; from: string; to: string }) =>
      await apiRequest('POST', '/api/care-time/template/apply', body),
    onSuccess: (result: any) => {
      invalidate();
      toast({
        title: t('success'),
        description: t('templateApplied', { created: result.created, skipped: result.skippedLocked }),
      });
    },
  });

  const days = Array.from({ length: 7 }, (_, offset) => addDays(monday, offset));
  const reservationFor = (date: string) =>
    reservations?.find((r) => r.childId === childId && r.date === date);

  const submitDay = (event: React.FormEvent<HTMLFormElement>, date: string) => {
    event.preventDefault();
    if (!childId) return;
    const form = new FormData(event.currentTarget);
    saveReservation.mutate({
      childId,
      date,
      startTime: String(form.get('startTime') ?? ''),
      endTime: String(form.get('endTime') ?? ''),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarClock className="h-7 w-7" />
            {t('careTime')}
          </h1>
          <p className="text-muted-foreground">{t('careTimeDescription')}</p>
        </div>

        {children && children.length > 1 && (
          <Select value={String(childId ?? '')} onValueChange={setSelectedChildId}>
            <SelectTrigger className="w-56" data-testid="select-care-time-child">
              <SelectValue placeholder={t('selectChild')} />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={String(child.id)}>{child.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-lg">{t('week')} {monday} &ndash; {sunday}</CardTitle>
            <CardDescription>{t('reservationsHint')}</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" aria-label={t('previousWeek')}
              onClick={() => setMonday(addDays(monday, -7))} data-testid="button-previous-week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label={t('nextWeek')}
              onClick={() => setMonday(addDays(monday, 7))} data-testid="button-next-week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : (
            days.map((date, index) => {
              const reservation = reservationFor(date);
              return (
                <form
                  key={date}
                  onSubmit={(event) => submitDay(event, date)}
                  className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
                  data-testid={`row-reservation-${date}`}
                >
                  <div className="min-w-32">
                    <div className="font-medium">{t(WEEKDAY_KEYS[index])}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">{date}</div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`start-${date}`} className="text-xs">{t('startTime')}</Label>
                    <Input id={`start-${date}`} name="startTime" type="time" required
                      defaultValue={reservation?.startTime ?? ''} className="w-32"
                      data-testid={`input-start-${date}`} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`end-${date}`} className="text-xs">{t('endTime')}</Label>
                    <Input id={`end-${date}`} name="endTime" type="time" required
                      defaultValue={reservation?.endTime ?? ''} className="w-32"
                      data-testid={`input-end-${date}`} />
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    {reservation && <Badge variant="secondary">{t('booked')}</Badge>}
                    <Button type="submit" size="sm" disabled={saveReservation.isPending}
                      data-testid={`button-save-${date}`}>
                      {t('save')}
                    </Button>
                    {reservation && (
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => childId && removeReservation.mutate({ childId, date })}
                        data-testid={`button-remove-${date}`}>
                        {t('remove')}
                      </Button>
                    )}
                  </div>
                </form>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            {t('weeklyTemplate')}
          </CardTitle>
          <CardDescription>{t('weeklyTemplateHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!childId) return;
              const form = new FormData(event.currentTarget);
              const days = WEEKDAY_KEYS.map((_, index) => {
                const weekday = index + 1;
                const start = String(form.get(`tstart-${weekday}`) ?? '');
                const end = String(form.get(`tend-${weekday}`) ?? '');
                return start && end ? { weekday, startTime: start, endTime: end } : null;
              }).filter((day): day is { weekday: number; startTime: string; endTime: string } => day !== null);
              saveTemplate.mutate({ childId, days });
            }}
          >
            {WEEKDAY_KEYS.map((key, index) => {
              const weekday = index + 1;
              const existing = template?.find((day) => day.weekday === weekday);
              return (
                <div key={key} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-32 font-medium">{t(key)}</div>
                  <Input name={`tstart-${weekday}`} type="time" defaultValue={existing?.startTime ?? ''}
                    className="w-32" aria-label={`${t(key)} ${t('startTime')}`}
                    data-testid={`input-template-start-${weekday}`} />
                  <Input name={`tend-${weekday}`} type="time" defaultValue={existing?.endTime ?? ''}
                    className="w-32" aria-label={`${t(key)} ${t('endTime')}`}
                    data-testid={`input-template-end-${weekday}`} />
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={saveTemplate.isPending} data-testid="button-save-template">
                {t('saveTemplate')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={applyTemplate.isPending || !template?.length}
                onClick={() => childId && applyTemplate.mutate({ childId, from: monday, to: addDays(monday, 27) })}
                data-testid="button-apply-template"
              >
                <Lock className="mr-2 h-3.5 w-3.5" />
                {t('applyTemplateFourWeeks')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
