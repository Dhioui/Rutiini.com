import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Building2, Plus, Trash2, MapPin, Utensils } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Daycare } from '@shared/schema';

const MUNICIPALITIES = ['Helsinki', 'Espoo', 'Vantaa', 'Tampere', 'Turku', 'Oulu'];

const AROMI_URLS: Record<string, string> = {
  'Helsinki': 'https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/PKeMenu/Page/Restaurant',
  'Espoo': 'https://aromimenu.cgisaas.fi/EspooAromieMenus/FI/Default/ESPOO',
  'Vantaa': 'https://aromimenu.cgisaas.fi/VantaaAromieMenus/FI/Default/Vantti',
};

export function DaycaresPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [menuSourceType, setMenuSourceType] = useState<'none' | 'aromi' | 'manual'>('none');
  const [menuSourceUrl, setMenuSourceUrl] = useState('');

  // Managing daycares is a super admin function -- /api/daycares rejects everyone
  // else. Without this guard the page rendered its full management UI for any
  // signed-in user and only then failed on a 403, which reads as a broken screen
  // rather than one they are not entitled to. UsersPage and AuditLogsPage already
  // guard this way; enabled below so the query does not fire either.
  const canManageDaycares = user?.role === 'super_admin';

  const { data: daycares, isLoading } = useQuery<Daycare[]>({
    queryKey: ['/api/daycares'],
    enabled: canManageDaycares,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      code: string; 
      municipality?: string;
      menuSourceType?: string;
      menuSourceUrl?: string;
    }) => {
      return await apiRequest('POST', '/api/daycares', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daycares'] });
      toast({
        title: t('success'),
        description: t('daycareCreated'),
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('daycareCodeInUse'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (daycareId: number) => {
      return await apiRequest('DELETE', `/api/daycares/${daycareId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daycares'] });
      toast({
        title: t('success'),
        description: t('daycareDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('daycareDeleteFailed'),
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setIsOpen(false);
    setName('');
    setCode('');
    setMunicipality('');
    setMenuSourceType('none');
    setMenuSourceUrl('');
  };

  const handleMunicipalityChange = (value: string) => {
    setMunicipality(value);
    if (menuSourceType === 'aromi' && AROMI_URLS[value]) {
      setMenuSourceUrl(AROMI_URLS[value]);
    }
  };

  const handleMenuSourceTypeChange = (value: 'none' | 'aromi' | 'manual') => {
    setMenuSourceType(value);
    if (value === 'aromi' && municipality && AROMI_URLS[municipality]) {
      setMenuSourceUrl(AROMI_URLS[municipality]);
    } else if (value !== 'aromi') {
      setMenuSourceUrl('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ 
      name, 
      code: code.toLowerCase(),
      municipality: municipality || undefined,
      menuSourceType,
      menuSourceUrl: menuSourceType === 'aromi' ? menuSourceUrl : undefined,
    });
  };

  if (!canManageDaycares) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">{t('accessDenied')}</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8">{t('loading')}</div>;
  }

  const groupedDaycares = daycares?.reduce((acc, daycare) => {
    const mun = daycare.municipality || t('unassigned');
    if (!acc[mun]) acc[mun] = [];
    acc[mun].push(daycare);
    return acc;
  }, {} as Record<string, Daycare[]>) || {};

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">{t('manageDaycares')}</h1>
          <p className="text-muted-foreground mt-1">{t('systemOverview')}</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-daycare">
              <Plus className="mr-2 h-4 w-4" />
              {t('addDaycare')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('addDaycare')}</DialogTitle>
              <DialogDescription>
                {t('daycareDialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="municipality">{t('municipality')}</Label>
                <Select value={municipality} onValueChange={handleMunicipalityChange}>
                  <SelectTrigger id="municipality" data-testid="select-municipality">
                    <SelectValue placeholder={t('selectMunicipality')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MUNICIPALITIES.map((mun) => (
                      <SelectItem key={mun} value={mun} data-testid={`option-municipality-${mun}`}>
                        {mun}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t('daycareName')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('daycareNamePlaceholder')}
                  required
                  data-testid="input-daycare-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">{t('daycareCode')}</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toLowerCase())}
                  placeholder={t('daycareCodePlaceholder')}
                  required
                  maxLength={20}
                  data-testid="input-daycare-code"
                />
                <p className="text-sm text-muted-foreground">
                  {t('daycareCodeHint')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="menuSource">{t('menuSourceType')}</Label>
                <Select value={menuSourceType} onValueChange={handleMenuSourceTypeChange}>
                  <SelectTrigger id="menuSource" data-testid="select-menu-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" data-testid="option-menu-none">{t('menuSourceNone')}</SelectItem>
                    <SelectItem value="aromi" data-testid="option-menu-aromi">{t('menuSourceAromi')}</SelectItem>
                    <SelectItem value="manual" data-testid="option-menu-manual">{t('menuSourceManual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {menuSourceType === 'aromi' && (
                <div className="space-y-2">
                  <Label htmlFor="menuUrl">{t('menuSourceUrl')}</Label>
                  <Input
                    id="menuUrl"
                    value={menuSourceUrl}
                    onChange={(e) => setMenuSourceUrl(e.target.value)}
                    placeholder="https://aromi..."
                    data-testid="input-menu-url"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('menuUrlHint')}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-daycare">
                  {createMutation.isPending ? t('creating') : t('save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="border-0 shadow-md" data-testid="card-daycare-stats">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalDaycares')}</CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-daycare-count">{daycares?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md" data-testid="card-municipality-stats">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('municipalities')}</CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-municipality-count">
              {Object.keys(groupedDaycares).filter(k => k !== t('unassigned')).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.entries(groupedDaycares).map(([municipalityName, municipalityDaycares]) => (
        <div key={municipalityName} className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            {municipalityName}
            <span className="text-sm font-normal text-muted-foreground">
              ({municipalityDaycares.length})
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid={`list-daycares-${municipalityName}`}>
            {municipalityDaycares.map((daycare) => (
              <Card key={daycare.id} className="border-0 shadow-md hover-elevate" data-testid={`card-daycare-${daycare.id}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg" data-testid={`text-daycare-name-${daycare.id}`}>
                        {daycare.name}
                      </CardTitle>
                      <CardDescription className="uppercase font-mono" data-testid={`text-daycare-code-${daycare.id}`}>
                        {daycare.code}
                      </CardDescription>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        data-testid={`button-delete-daycare-${daycare.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDaycare')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('confirmDeleteDaycare')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="flex gap-2 justify-end">
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(daycare.id)}
                          disabled={deleteMutation.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteMutation.isPending ? t('deleting') : t('delete')}
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Utensils className="h-3 w-3" />
                    {daycare.menuSourceType === 'aromi' 
                      ? t('menuSourceAromi')
                      : daycare.menuSourceType === 'manual'
                      ? t('menuSourceManual')
                      : t('menuSourceNone')
                    }
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {(!daycares || daycares.length === 0) && (
        <Card className="border-0 shadow-md" data-testid="card-no-daycares">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('noDaycares')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
