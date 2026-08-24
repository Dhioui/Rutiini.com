import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Child } from '@shared/schema';

interface Absence {
  id: number;
  childId: number;
  daycareId: number;
  type: string;
  date: string;
  reason: string | null;
  reportedById: number;
  createdAt: string;
  childName?: string;
  reportedByName?: string;
}

const absenceFormSchema = z.object({
  childId: z.string().min(1, 'Child is required'),
  type: z.enum(['absence', 'sickness', 'late_arrival', 'early_pickup'], {
    required_error: 'Absence type is required',
  }),
  date: z.string().min(1, 'Date is required'),
  reason: z.string().optional(),
});

type AbsenceFormValues = z.infer<typeof absenceFormSchema>;

export function AbsencesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      childId: '',
      type: undefined,
      date: '',
      reason: '',
    },
  });

  const { data: children, isLoading: childrenLoading } = useQuery<Child[]>({
    queryKey: ['/api/children'],
  });

  const { data: absences, isLoading: absencesLoading } = useQuery<Absence[]>({
    queryKey: ['/api/absences'],
  });

  const reportAbsenceMutation = useMutation({
    mutationFn: async (data: { childId: number; type: string; date: string; reason?: string }) => {
      return await apiRequest('POST', '/api/absences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/absences'] });
      form.reset();
      toast({
        title: t('success'),
        description: t('absenceCreated'),
      });
    },
  });

  const onSubmit = (values: AbsenceFormValues) => {
    reportAbsenceMutation.mutate({
      childId: parseInt(values.childId),
      type: values.type,
      date: values.date,
      reason: values.reason,
    });
  };

  const absenceTypes = [
    { value: 'absence', label: t('absence') },
    { value: 'sickness', label: t('sickness') },
    { value: 'late_arrival', label: t('lateArrival') },
    { value: 'early_pickup', label: t('earlyPickup') },
  ];

  const getAbsenceTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'sickness':
        return 'destructive';
      case 'late_arrival':
      case 'early_pickup':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const isGuardian = user?.role === 'guardian';
  // Mirrors the server rule. super_admin is excluded deliberately: the API
  // rejects it and logs ACCESS_DENIED, and the product's GDPR position is that
  // a super admin never reaches personal data. Offering the control anyway put a
  // button in front of them that could only ever fail.
  const canReportAbsence = user?.role === 'guardian';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('absences')}</h1>
          <p className="text-muted-foreground mt-1">
            {isGuardian ? t('reportAbsence') : `${absences?.length || 0} ${t('absences').toLowerCase()}`}
          </p>
        </div>
      </div>

      {canReportAbsence && (
        <Card className="border-0 shadow-md" data-testid="card-report-absence">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {t('reportAbsence')}
            </CardTitle>
            <CardDescription>{t('reportAbsence')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="childId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('childName')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger id="child" data-testid="select-absence-child">
                              <SelectValue placeholder={t('childName')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {children?.map((child) => (
                              <SelectItem key={child.id} value={child.id.toString()}>
                                {child.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('absenceType')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger id="type" data-testid="select-absence-type">
                              <SelectValue placeholder={t('selectAbsenceType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {absenceTypes.map((absenceType) => (
                              <SelectItem key={absenceType.value} value={absenceType.value}>
                                {absenceType.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('absenceDate')}</FormLabel>
                        <FormControl>
                          <Input
                            id="date"
                            type="date"
                            data-testid="input-absence-date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{t('reason')} ({t('optional')})</FormLabel>
                        <FormControl>
                          <Textarea
                            id="reason"
                            placeholder={t('reason')}
                            rows={3}
                            data-testid="textarea-absence-reason"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" disabled={reportAbsenceMutation.isPending} data-testid="button-report-absence">
                  {reportAbsenceMutation.isPending ? t('loading') : t('reportAbsence')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-semibold mb-4">
          {isGuardian ? t('myChildren') + ' ' + t('absences') : t('absences')}
        </h2>
        
        {absencesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-md">
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : absences && absences.length > 0 ? (
          <div className="space-y-3" data-testid="list-absences">
            {absences.map((absence) => (
              <Card key={absence.id} className="border-0 shadow-md" data-testid={`card-absence-${absence.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {absence.childName || `Child ${absence.childId}`}
                      </CardTitle>
                      <CardDescription>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={getAbsenceTypeBadgeVariant(absence.type)} data-testid={`badge-absence-type-${absence.id}`}>
                            {absenceTypes.find((t) => t.value === absence.type)?.label || absence.type}
                          </Badge>
                          <span className="flex items-center gap-1" data-testid={`text-absence-date-${absence.id}`}>
                            <Calendar className="h-3 w-3" />
                            {format(new Date(absence.date), 'PP')}
                          </span>
                          {absence.reportedByName && (
                            <span className="text-xs" data-testid={`text-reported-by-${absence.id}`}>
                              {t('reportedBy')}: {absence.reportedByName}
                            </span>
                          )}
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                  {absence.reason && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground" data-testid={`text-absence-reason-${absence.id}`}>
                        {absence.reason}
                      </p>
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-md" data-testid="card-no-absences">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground" data-testid="text-no-absences">{t('noAbsences')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AbsencesPage;
