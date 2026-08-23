import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Baby, Bus, Calendar, BarChart3, LayoutGrid, TableIcon } from 'lucide-react';

interface DaycareStat {
  daycareId: number;
  daycareName: string;
  childrenCount: number;
  staffCount: number;
  guardianCount: number;
}

interface AnonymizedStats {
  totalDaycares: number;
  totalChildren: number;
  totalStaff: number;
  totalGuardians: number;
  totalTrips: number;
  totalAbsencesToday: number;
  daycareStats: DaycareStat[];
}

export function SuperAdminStatsPage() {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery<AnonymizedStats>({
    queryKey: ['/api/super-admin/stats'],
  });

  if (isLoading) {
    return <div className="p-8">{t('loading')}</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">{t('systemStats')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('anonymizedStatsDescription')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="border-0 shadow-md" data-testid="card-stat-daycares">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalDaycares')}</CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-daycares">
              {stats?.totalDaycares || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-children">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalChildren')}</CardTitle>
            <div className="rounded-full bg-blue-500/10 p-2">
              <Baby className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-children">
              {stats?.totalChildren || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-staff">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalStaff')}</CardTitle>
            <div className="rounded-full bg-green-500/10 p-2">
              <Users className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-staff">
              {stats?.totalStaff || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-guardians">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalGuardians')}</CardTitle>
            <div className="rounded-full bg-purple-500/10 p-2">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-guardians">
              {stats?.totalGuardians || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-trips">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalTrips')}</CardTitle>
            <div className="rounded-full bg-orange-500/10 p-2">
              <Bus className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-trips">
              {stats?.totalTrips || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-stat-absences">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('absencesToday')}</CardTitle>
            <div className="rounded-full bg-red-500/10 p-2">
              <Calendar className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-absences-today">
              {stats?.totalAbsencesToday || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md" data-testid="card-daycare-breakdown">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('daycares')}
          </CardTitle>
          <CardDescription>
            {t('anonymizedStatsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.daycareStats && stats.daycareStats.length > 0 ? (
            <Tabs defaultValue="table" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="table" data-testid="tab-table-view">
                  <TableIcon className="h-4 w-4 mr-2" />
                  {t('tableView')}
                </TabsTrigger>
                <TabsTrigger value="cards" data-testid="tab-cards-view">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  {t('cardView')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="table" data-testid="table-view-content">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('daycare')}</TableHead>
                        <TableHead className="text-right">{t('children')}</TableHead>
                        <TableHead className="text-right">{t('staff')}</TableHead>
                        <TableHead className="text-right">{t('guardians')}</TableHead>
                        <TableHead className="text-right">{t('totalUsers')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.daycareStats.map((dc) => (
                        <TableRow key={dc.daycareId} data-testid={`table-row-daycare-${dc.daycareId}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              {dc.daycareName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{dc.childrenCount}</TableCell>
                          <TableCell className="text-right">{dc.staffCount}</TableCell>
                          <TableCell className="text-right">{dc.guardianCount}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {dc.childrenCount + dc.staffCount + dc.guardianCount}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>{t('total')}</TableCell>
                        <TableCell className="text-right">{stats.totalChildren}</TableCell>
                        <TableCell className="text-right">{stats.totalStaff}</TableCell>
                        <TableCell className="text-right">{stats.totalGuardians}</TableCell>
                        <TableCell className="text-right">
                          {stats.totalChildren + stats.totalStaff + stats.totalGuardians}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="cards" data-testid="cards-view-content">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stats.daycareStats.map((dc) => (
                    <div 
                      key={dc.daycareId} 
                      className="p-4 rounded-lg border bg-card"
                      data-testid={`stat-daycare-${dc.daycareId}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Building2 className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{dc.daycareName}</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-2 rounded bg-muted/50">
                          <div className="text-2xl font-bold text-primary">{dc.childrenCount}</div>
                          <div className="text-xs text-muted-foreground">{t('children')}</div>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/50">
                          <div className="text-2xl font-bold text-primary">{dc.staffCount}</div>
                          <div className="text-xs text-muted-foreground">{t('staff')}</div>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/50">
                          <div className="text-2xl font-bold text-primary">{dc.guardianCount}</div>
                          <div className="text-xs text-muted-foreground">{t('guardians')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('noDaycares')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
