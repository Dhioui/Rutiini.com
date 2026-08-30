import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, DoorOpen, LogIn, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AttendanceRow {
  childId: number;
  name: string;
  allergies: string | null;
  reserved: { startTime: string; endTime: string } | null;
  absent: boolean;
  present: boolean;
  realisedMinutes: number;
  openRecordId: number | null;
}

function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h ${String(rest).padStart(2, '0')} min`;
}

/**
 * The shared device by the door.
 *
 * One row per child, one tap to record arrival or departure. Deliberately plain
 * and large: it is operated standing up, with a coat in one hand.
 */
export function AttendancePage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ date: string; children: AttendanceRow[] }>({
    queryKey: ['/api/care-time/today'],
    // Several members of staff use the same list at the same time.
    refetchInterval: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['/api/care-time/today'] });

  const checkIn = useMutation({
    mutationFn: async (childId: number) => await apiRequest('POST', '/api/care-time/check-in', { childId }),
    onSuccess: refresh,
    onError: () => toast({ title: t('error'), description: t('checkInFailed'), variant: 'destructive' }),
  });

  const checkOut = useMutation({
    mutationFn: async (childId: number) => await apiRequest('POST', '/api/care-time/check-out', { childId }),
    onSuccess: refresh,
    onError: () => toast({ title: t('error'), description: t('checkOutFailed'), variant: 'destructive' }),
  });

  const present = data?.children.filter((row) => row.present).length ?? 0;
  const expected = data?.children.filter((row) => row.reserved && !row.absent).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DoorOpen className="h-7 w-7" />
          {t('attendance')}
        </h1>
        <p className="text-muted-foreground">
          {data?.date} &middot; {t('presentNow', { present, expected })}
        </p>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('childrenToday')}</CardTitle>
          <CardDescription>{t('attendanceHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : data?.children.length ? (
            data.children.map((row) => (
              <div
                key={row.childId}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                data-testid={`row-attendance-${row.childId}`}
              >
                <div className="min-w-48">
                  <div className="font-medium text-lg">{row.name}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {row.reserved
                      ? `${t('reserved')} ${row.reserved.startTime}–${row.reserved.endTime}`
                      : t('noReservation')}
                  </div>
                </div>

                {row.allergies && (
                  <Badge variant="destructive" className="gap-1" data-testid={`badge-allergy-${row.childId}`}>
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {row.allergies}
                  </Badge>
                )}

                {row.absent && <Badge variant="outline">{t('reportedAbsent')}</Badge>}

                <div className="ml-auto flex items-center gap-3">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatHours(row.realisedMinutes)}
                  </span>

                  {row.present ? (
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={checkOut.isPending}
                      onClick={() => checkOut.mutate(row.childId)}
                      data-testid={`button-check-out-${row.childId}`}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('checkOut')}
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      disabled={checkIn.isPending}
                      onClick={() => checkIn.mutate(row.childId)}
                      data-testid={`button-check-in-${row.childId}`}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      {t('checkIn')}
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center">{t('noChildren')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
